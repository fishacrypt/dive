import { randomUUID } from 'node:crypto'
import { prisma } from '@/server/db'
import { provisionPlayer } from '@/server/services/demo'
import { generateInstance } from '@/server/services/challenges'
import { reconcile } from '@/server/services/ledger'

/** A brand-new player with starting resources and a Starter Rig. */
export async function newPlayer(overrides: { credits?: number; energy?: number; level?: number } = {}): Promise<string> {
  const id = await provisionPlayer(`t-${randomUUID().slice(0, 12)}`, 'Test Miner')
  await setBalances(id, overrides)
  return id
}

/** Directly set balances AND add a ledger GRANT/adjustment so balances still reconcile. */
export async function setBalances(playerId: string, o: { credits?: number; energy?: number; level?: number }): Promise<void> {
  const p = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
  const adjustments: Array<['CREDITS' | 'ENERGY', number]> = []
  if (o.credits !== undefined) adjustments.push(['CREDITS', o.credits - p.credits])
  if (o.energy !== undefined) adjustments.push(['ENERGY', o.energy - p.energy])
  for (const [resource, delta] of adjustments) {
    if (delta === 0) continue
    const field = resource === 'CREDITS' ? 'credits' : 'energy'
    const updated = await prisma.player.update({ where: { id: playerId }, data: { [field]: { increment: delta } } })
    await prisma.ledgerEntry.create({
      data: { playerId, type: 'GRANT', resource, amount: delta, balanceAfter: updated[field], refType: 'test', refId: 'setup', memo: 'Test adjustment' },
    })
  }
  if (o.level !== undefined) await prisma.player.update({ where: { id: playerId }, data: { level: o.level } })
}

export async function equipmentId(slug: string): Promise<string> {
  return (await prisma.equipmentDefinition.findUniqueOrThrow({ where: { slug } })).id
}

export async function definitionId(slug: string): Promise<string> {
  return (await prisma.challengeDefinition.findUniqueOrThrow({ where: { slug } })).id
}

/** Give a player an item without paying (ownership setup only). */
export async function giveItem(playerId: string, slug: string): Promise<string> {
  const item = await prisma.inventoryItem.create({ data: { playerId, equipmentId: await equipmentId(slug) } })
  return item.id
}

export async function openChallenge(playerId: string, slug: string, seed = 12345) {
  return generateInstance(playerId, await definitionId(slug), seed)
}

export async function expectReconciled(playerId: string): Promise<void> {
  const rows = await reconcile(playerId)
  for (const r of rows) {
    if (!r.reconciled) throw new Error(`${r.resource} does not reconcile: balance ${r.balance} vs ledger ${r.ledgerSum}`)
  }
}
