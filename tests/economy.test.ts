import { describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'
import { DomainError } from '@/server/errors'
import { exchangeQuanta, rechargeEnergy } from '@/server/services/economy'
import { listLedger } from '@/server/services/ledger'
import { listInventory, purchaseEquipment, upgradeItem } from '@/server/services/marketplace'
import { ENERGY, STARTING_RESOURCES } from '@/lib/game/config'
import { equipmentId, expectReconciled, giveItem, newPlayer, setBalances } from './helpers'

async function credits(playerId: string): Promise<number> {
  return (await prisma.player.findUniqueOrThrow({ where: { id: playerId } })).credits
}

describe('starting state', () => {
  it('records starting resources as ledger grants that reconcile', async () => {
    const id = await newPlayer()
    const player = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(player.credits).toBe(STARTING_RESOURCES.credits)
    expect(player.energy).toBe(STARTING_RESOURCES.energy)
    const ledger = await listLedger(id)
    expect(ledger.entries.every((e) => e.type === 'GRANT')).toBe(true)
    await expectReconciled(id)
  })
})

describe('purchases', () => {
  it('charges the server-side price, adds the item and writes a ledger entry', async () => {
    const id = await newPlayer()
    const before = await credits(id)
    const result = await purchaseEquipment(id, await equipmentId('cpu-pulse'))
    expect(result.item.equipment.slug).toBe('cpu-pulse')
    const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { playerId: id, type: 'PURCHASE' } })
    expect(entry).toMatchObject({ resource: 'CREDITS', amount: -120, refId: result.item.id })
    // Price paid, plus the one-time "first purchase" achievement bonus.
    const bonus = (await prisma.achievementDefinition.findUniqueOrThrow({ where: { slug: 'first-purchase' } })).rewardCredits
    expect(await credits(id)).toBe(before - 120 + bonus)
    await expectReconciled(id)
  })

  it('rejects a purchase the player cannot afford and never goes negative', async () => {
    const id = await newPlayer({ credits: 50 })
    await expect(purchaseEquipment(id, await equipmentId('cpu-pulse'))).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    expect(await credits(id)).toBe(50)
    expect(await prisma.inventoryItem.count({ where: { playerId: id, equipment: { slug: 'cpu-pulse' } } })).toBe(1) // only the starter one
    await expectReconciled(id)
  })

  it('enforces level requirements', async () => {
    const id = await newPlayer({ credits: 10_000 })
    await expect(purchaseEquipment(id, await equipmentId('gpu-nova'))).rejects.toMatchObject({ code: 'LEVEL_LOCKED' })
    await setBalances(id, { level: 7 })
    await expect(purchaseEquipment(id, await equipmentId('gpu-nova'))).resolves.toBeDefined()
  })

  it('rejects unknown equipment', async () => {
    const id = await newPlayer()
    await expect(purchaseEquipment(id, 'does-not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('is safe under concurrency: parallel purchases cannot overspend', async () => {
    const id = await newPlayer({ credits: 130 }) // affords exactly one 120-credit item, even after the 25-credit achievement bonus
    const eq = await equipmentId('cpu-pulse')
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => purchaseEquipment(id, eq)))
    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(7)
    for (const f of failed) expect((f.reason as DomainError).code).toBe('INSUFFICIENT_FUNDS')
    expect(await credits(id)).toBe(130 - 120 + 25)
    expect(await prisma.inventoryItem.count({ where: { playerId: id, equipment: { slug: 'cpu-pulse' } } })).toBe(2) // starter + purchase
    await expectReconciled(id)
  })

  it('treats a repeated idempotency key as the same purchase', async () => {
    const id = await newPlayer()
    const eq = await equipmentId('ram-8')
    const key = 'purchase-key-0001'
    const first = await purchaseEquipment(id, eq, key)
    const second = await purchaseEquipment(id, eq, key)
    expect(second.replayed).toBe(true)
    expect(second.item.id).toBe(first.item.id)
    expect(await prisma.ledgerEntry.count({ where: { playerId: id, type: 'PURCHASE' } })).toBe(1)
    await expectReconciled(id)
  })

  it('parallel requests with the same idempotency key charge once', async () => {
    const id = await newPlayer()
    const eq = await equipmentId('ram-8')
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => purchaseEquipment(id, eq, 'same-key-parallel')))
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect(await prisma.ledgerEntry.count({ where: { playerId: id, type: 'PURCHASE' } })).toBe(1)
    expect(await prisma.inventoryItem.count({ where: { playerId: id, equipment: { slug: 'ram-8' } } })).toBe(2) // starter + one purchase
    await expectReconciled(id)
  })
})

describe('upgrades', () => {
  it('upgrades step by step, charges the derived cost, and stops at the cap', async () => {
    const id = await newPlayer({ credits: 5000 })
    const item = await giveItem(id, 'cpu-vector') // price 450
    const one = await upgradeItem(id, item)
    expect(one.item.level).toBe(2)
    const upgrades = await prisma.ledgerEntry.findMany({ where: { playerId: id, type: 'UPGRADE' } })
    expect(upgrades.map((u) => u.amount)).toEqual([-Math.ceil(450 * 0.4)])
    const two = await upgradeItem(id, item)
    expect(two.item.level).toBe(3)
    await expect(upgradeItem(id, item)).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expectReconciled(id)
  })

  it('cannot upgrade someone else\'s item or without funds', async () => {
    const owner = await newPlayer({ credits: 5000 })
    const thief = await newPlayer({ credits: 5000 })
    const item = await giveItem(owner, 'cpu-pulse')
    await expect(upgradeItem(thief, item)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const poor = await newPlayer({ credits: 1 })
    const own = await giveItem(poor, 'cpu-pulse')
    await expect(upgradeItem(poor, own)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    expect((await listInventory(poor)).find((i) => i.id === own)?.level).toBe(1)
  })

  it('parallel upgrades of the same item cannot skip or double-charge a level', async () => {
    const id = await newPlayer({ credits: 5000 })
    const item = await giveItem(id, 'cpu-pulse')
    const results = await Promise.allSettled([upgradeItem(id, item), upgradeItem(id, item), upgradeItem(id, item), upgradeItem(id, item)])
    const level = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item } })).level
    expect(level).toBeLessThanOrEqual(3)
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(level - 1)
    await expectReconciled(id)
  })
})

describe('energy and refinery', () => {
  it('recharges energy for credits and respects the cap', async () => {
    const id = await newPlayer({ energy: 900 })
    const r = await rechargeEnergy(id, 1)
    expect(r.energy).toBe(1000)
    await expect(rechargeEnergy(id, 1)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).energy).toBeLessThanOrEqual(ENERGY.cap)
    await expectReconciled(id)
  })

  it('refuses to recharge without credits', async () => {
    const id = await newPlayer({ credits: 5, energy: 0 })
    await expect(rechargeEnergy(id, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).energy).toBe(0)
  })

  it('cannot refine Quanta the player does not have', async () => {
    const id = await newPlayer()
    await expect(exchangeQuanta(id, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
  })

  it('refines whole Quanta into credits, one-way, with matching ledger entries', async () => {
    const id = await newPlayer()
    await prisma.player.update({ where: { id }, data: { quantaMilli: 3000 } })
    await prisma.ledgerEntry.create({ data: { playerId: id, type: 'GRANT', resource: 'QUANTA', amount: 3000, balanceAfter: 3000, refType: 'test', refId: 'x', memo: 'test' } })
    const out = await exchangeQuanta(id, 2)
    expect(out.credits).toBe(STARTING_RESOURCES.credits + 300)
    expect(out.quantaMilli).toBe(1000)
    await expectReconciled(id)
  })
})
