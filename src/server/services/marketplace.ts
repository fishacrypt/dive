import type { EquipmentDefinition, InventoryItem } from '@prisma/client'
import { prisma } from '../db'
import { DomainError, notFound } from '../errors'
import { adjust, findByIdempotencyKey, namespaced } from './ledger'
import { evaluateAchievements } from './progression'
import { upgradeCost } from '@/lib/game/rig'

export function serializeEquipment(e: EquipmentDefinition) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    kind: e.kind,
    tier: e.tier,
    description: e.description,
    price: e.price,
    requiredLevel: e.requiredLevel,
    compute: e.compute,
    memory: e.memory,
    powerDraw: e.powerDraw,
    powerCapacity: e.powerCapacity,
    heat: e.heat,
    coolingCapacity: e.coolingCapacity,
    accelSlots: e.accelSlots,
    memSlots: e.memSlots,
  }
}

export function serializeItem(item: InventoryItem, equipment: EquipmentDefinition, rigId: string | null) {
  return {
    id: item.id,
    level: item.level,
    acquiredAt: item.acquiredAt.toISOString(),
    rigId,
    upgradeCost: upgradeCost(equipment.price, item.level),
    equipment: serializeEquipment(equipment),
  }
}

export async function listMarketplace(playerId: string) {
  const [player, equipment, owned] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { level: true, credits: true } }),
    prisma.equipmentDefinition.findMany({ orderBy: [{ kind: 'asc' }, { tier: 'asc' }, { price: 'asc' }] }),
    prisma.inventoryItem.groupBy({ by: ['equipmentId'], where: { playerId }, _count: { _all: true } }),
  ])
  const ownedCount = new Map(owned.map((o) => [o.equipmentId, o._count._all]))
  return {
    playerLevel: player.level,
    credits: player.credits,
    items: equipment.map((e) => ({
      ...serializeEquipment(e),
      owned: ownedCount.get(e.id) ?? 0,
      locked: player.level < e.requiredLevel,
      affordable: player.credits >= e.price,
    })),
  }
}

/**
 * Buy one piece of equipment. The price always comes from the database, never
 * from the client. Charge, inventory and ledger entry commit together or not
 * at all. A repeated idempotency key returns the original purchase.
 */
export async function purchaseEquipment(playerId: string, equipmentId: string, idempotencyKey?: string) {
  const key = namespaced('purchase', idempotencyKey)
  try {
    return await prisma.$transaction(async (tx) => {
      if (key) {
        const prior = await findByIdempotencyKey(tx, playerId, key)
        if (prior) {
          const item = await tx.inventoryItem.findFirst({ where: { id: prior.refId, playerId }, include: { equipment: true } })
          if (item) return { item: serializeItem(item, item.equipment, null), balance: prior.balanceAfter, replayed: true }
        }
      }
      const [player, equipment] = await Promise.all([
        tx.player.findUniqueOrThrow({ where: { id: playerId } }),
        tx.equipmentDefinition.findUnique({ where: { id: equipmentId } }),
      ])
      if (!equipment) throw notFound('Equipment')
      if (player.level < equipment.requiredLevel) {
        throw new DomainError('LEVEL_LOCKED', `Requires level ${equipment.requiredLevel}.`)
      }
      const item = await tx.inventoryItem.create({ data: { playerId, equipmentId: equipment.id }, include: { equipment: true } })
      const balance = await adjust(tx, playerId, 'CREDITS', -equipment.price, {
        type: 'PURCHASE',
        refType: 'inventoryItem',
        refId: item.id,
        memo: `Purchased ${equipment.name}`,
        idempotencyKey: key,
      })
      const achievements = await evaluateAchievements(tx, playerId)
      return { item: serializeItem(item, item.equipment, null), balance, replayed: false, achievements }
    })
  } catch (error) {
    // Two identical requests raced: the loser hit the unique key and rolled back. Return the winner's result.
    if (key && isUniqueViolation(error)) {
      const prior = await prisma.ledgerEntry.findFirst({ where: { playerId, idempotencyKey: key } })
      const item = prior ? await prisma.inventoryItem.findFirst({ where: { id: prior.refId, playerId }, include: { equipment: true } }) : null
      if (prior && item) return { item: serializeItem(item, item.equipment, null), balance: prior.balanceAfter, replayed: true }
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
}

export async function listInventory(playerId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { playerId },
    include: { equipment: true, assigned: true },
    orderBy: [{ equipment: { kind: 'asc' } }, { acquiredAt: 'asc' }],
  })
  return items.map((i) => serializeItem(i, i.equipment, i.assigned?.rigId ?? null))
}

/** Upgrade an owned item by one level. Cost is derived server-side. */
export async function upgradeItem(playerId: string, itemId: string, idempotencyKey?: string) {
  const key = namespaced('upgrade', idempotencyKey)
  return prisma.$transaction(async (tx) => {
    if (key) {
      const prior = await findByIdempotencyKey(tx, playerId, key)
      if (prior) {
        const item = await tx.inventoryItem.findFirst({ where: { id: itemId, playerId }, include: { equipment: true, assigned: true } })
        if (item) return { item: serializeItem(item, item.equipment, item.assigned?.rigId ?? null), balance: prior.balanceAfter, replayed: true }
      }
    }
    const item = await tx.inventoryItem.findFirst({ where: { id: itemId, playerId }, include: { equipment: true } })
    if (!item) throw notFound('Item')
    const cost = upgradeCost(item.equipment.price, item.level)
    if (cost === null) throw new DomainError('INVALID_STATE', 'This item is already at the maximum level.')
    // Guard against a concurrent double-upgrade: only succeeds if the level is still what we read.
    const moved = await tx.inventoryItem.updateMany({ where: { id: item.id, playerId, level: item.level }, data: { level: { increment: 1 } } })
    if (moved.count === 0) throw new DomainError('CONFLICT', 'This item was just upgraded. Refresh and try again.')
    const balance = await adjust(tx, playerId, 'CREDITS', -cost, {
      type: 'UPGRADE',
      refType: 'inventoryItem',
      refId: item.id,
      memo: `Upgraded ${item.equipment.name} to level ${item.level + 1}`,
      idempotencyKey: key,
    })
    const achievements = await evaluateAchievements(tx, playerId)
    const fresh = await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id }, include: { equipment: true, assigned: true } })
    return { item: serializeItem(fresh, fresh.equipment, fresh.assigned?.rigId ?? null), balance, replayed: false, achievements }
  })
}
