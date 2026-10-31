import { Prisma, type EquipmentDefinition, type InventoryItem, type RigComponent } from '@prisma/client'
import { prisma } from '../db'
import { DomainError, notFound } from '../errors'
import type { Tx } from './ledger'
import { evaluateAchievements } from './progression'
import { serializeEquipment } from './marketplace'
import { RIG_RULES } from '@/lib/game/config'
import { checkAssignment, checkRemoval, computeRigStats } from '@/lib/game/rig'
import type { RigPart } from '@/lib/game/types'

type ComponentWithItem = RigComponent & { item: InventoryItem & { equipment: EquipmentDefinition } }

export function toRigPart(item: InventoryItem & { equipment: EquipmentDefinition }): RigPart {
  const e = item.equipment
  return {
    kind: e.kind,
    level: item.level,
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

export function serializeRig(
  rig: { id: string; name: string; createdAt: Date; components: ComponentWithItem[] },
  runningJobId: string | null,
) {
  const parts = rig.components.map((c) => toRigPart(c.item))
  return {
    id: rig.id,
    name: rig.name,
    createdAt: rig.createdAt.toISOString(),
    busy: runningJobId !== null,
    runningJobId,
    stats: computeRigStats(parts),
    components: rig.components.map((c) => ({
      itemId: c.inventoryItemId,
      level: c.item.level,
      equipment: serializeEquipment(c.item.equipment),
    })),
  }
}

const rigInclude = { components: { include: { item: { include: { equipment: true } } } } } as const

async function runningJobIds(playerId: string): Promise<Map<string, string>> {
  const running = await prisma.miningJob.findMany({ where: { playerId, status: 'RUNNING' }, select: { id: true, rigId: true } })
  return new Map(running.map((j) => [j.rigId, j.id]))
}

export async function listRigs(playerId: string) {
  const [rigs, running] = await Promise.all([
    prisma.rig.findMany({ where: { playerId }, include: rigInclude, orderBy: { createdAt: 'asc' } }),
    runningJobIds(playerId),
  ])
  return rigs.map((r) => serializeRig(r, running.get(r.id) ?? null))
}

export async function getRig(playerId: string, rigId: string) {
  const rig = await prisma.rig.findFirst({ where: { id: rigId, playerId }, include: rigInclude })
  if (!rig) throw notFound('Rig')
  const running = await prisma.miningJob.findFirst({ where: { rigId, status: 'RUNNING' }, select: { id: true } })
  return serializeRig(rig, running?.id ?? null)
}

/** Lock the rig row so concurrent edits and job starts on the same rig run one at a time. */
export async function lockRig(tx: Tx, playerId: string, rigId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Rig" WHERE "id" = ${rigId} AND "playerId" = ${playerId} FOR UPDATE`,
  )
  if (rows.length === 0) throw notFound('Rig')
}

async function assertNotBusy(tx: Tx, rigId: string): Promise<void> {
  const busy = await tx.miningJob.findFirst({ where: { rigId, status: 'RUNNING' }, select: { id: true } })
  if (busy) throw new DomainError('INVALID_STATE', 'This rig is running a job. Wait for it to finish or cancel it first.')
}

export async function createRig(playerId: string, name: string) {
  const rig = await prisma.$transaction(async (tx) => {
    // Serialise rig creation per player so the cap cannot be exceeded by parallel requests.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`)
    const count = await tx.rig.count({ where: { playerId } })
    if (count >= RIG_RULES.maxRigsPerPlayer) {
      throw new DomainError('CONFLICT', `You can own at most ${RIG_RULES.maxRigsPerPlayer} rigs.`)
    }
    const created = await tx.rig.create({ data: { playerId, name }, include: rigInclude })
    await evaluateAchievements(tx, playerId)
    return created
  })
  return serializeRig(rig, null)
}

export async function renameRig(playerId: string, rigId: string, name: string) {
  const result = await prisma.rig.updateMany({ where: { id: rigId, playerId }, data: { name } })
  if (result.count === 0) throw notFound('Rig')
  return getRig(playerId, rigId)
}

export async function deleteRig(playerId: string, rigId: string) {
  await prisma.$transaction(async (tx) => {
    await lockRig(tx, playerId, rigId)
    await assertNotBusy(tx, rigId)
    const jobs = await tx.miningJob.count({ where: { rigId } })
    if (jobs > 0) throw new DomainError('INVALID_STATE', 'Rigs with job history cannot be deleted. Strip its components instead.')
    // Components are released back to the inventory by the cascade.
    await tx.rig.delete({ where: { id: rigId } })
  })
  return { deleted: true }
}

export async function assignComponent(playerId: string, rigId: string, inventoryItemId: string) {
  await prisma.$transaction(async (tx) => {
    await lockRig(tx, playerId, rigId)
    await assertNotBusy(tx, rigId)
    const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, playerId }, include: { equipment: true, assigned: true } })
    if (!item) throw notFound('Inventory item')
    if (item.assigned) throw new DomainError('CONFLICT', 'That item is already installed in a rig.')
    const existing = await tx.rigComponent.findMany({ where: { rigId }, include: { item: { include: { equipment: true } } } })
    const problem = checkAssignment(existing.map((c) => toRigPart(c.item)), toRigPart(item))
    if (problem) throw new DomainError('INCOMPATIBLE', problem)
    await tx.rigComponent.create({ data: { rigId, inventoryItemId } })
    await tx.rig.update({ where: { id: rigId }, data: { updatedAt: new Date() } })
  })
  return getRig(playerId, rigId)
}

export async function removeComponent(playerId: string, rigId: string, inventoryItemId: string) {
  await prisma.$transaction(async (tx) => {
    await lockRig(tx, playerId, rigId)
    await assertNotBusy(tx, rigId)
    const components = await tx.rigComponent.findMany({ where: { rigId }, include: { item: { include: { equipment: true } } } })
    const target = components.find((c) => c.inventoryItemId === inventoryItemId)
    if (!target) throw notFound('Component')
    const problem = checkRemoval(components.map((c) => toRigPart(c.item)), toRigPart(target.item))
    if (problem) throw new DomainError('INCOMPATIBLE', problem)
    await tx.rigComponent.delete({ where: { id: target.id } })
  })
  return getRig(playerId, rigId)
}
