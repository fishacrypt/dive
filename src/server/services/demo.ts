import { prisma } from '../db'
import { DomainError } from '../errors'
import { adjust } from './ledger'
import { STARTER_LOADOUT } from '@/lib/game/catalog'
import { STARTING_RESOURCES } from '@/lib/game/config'

/**
 * Create a player with balanced starting resources and a ready-to-run starter
 * rig. Starting balances are recorded as GRANT ledger entries so balances
 * reconcile from the very first entry.
 */
export async function provisionPlayer(handle: string, displayName: string): Promise<string> {
  const equipment = await prisma.equipmentDefinition.findMany({ where: { slug: { in: [...STARTER_LOADOUT] } } })
  if (equipment.length !== STARTER_LOADOUT.length) {
    throw new DomainError('NOT_FOUND', 'Game catalog is empty. Run `bun run db:seed` first.')
  }

  return prisma.$transaction(async (tx) => {
    const player = await tx.player.create({ data: { handle, displayName, credits: 0, quantaMilli: 0, energy: 0 } })

    const grants = [
      ['CREDITS', STARTING_RESOURCES.credits],
      ['ENERGY', STARTING_RESOURCES.energy],
    ] as const
    for (const [resource, amount] of grants) {
      await adjust(tx, player.id, resource, amount, {
        type: 'GRANT',
        refType: 'player',
        refId: player.id,
        memo: 'Starting resources (simulated)',
        idempotencyKey: `grant:${resource}`,
      })
    }

    const rig = await tx.rig.create({ data: { playerId: player.id, name: 'Starter Rig' } })
    for (const slug of STARTER_LOADOUT) {
      const def = equipment.find((e) => e.slug === slug)
      if (!def) continue
      const item = await tx.inventoryItem.create({ data: { playerId: player.id, equipmentId: def.id } })
      await tx.rigComponent.create({ data: { rigId: rig.id, inventoryItemId: item.id } })
    }
    return player.id
  })
}

/** Wipe the demo player's progress and start over. Disabled in production. */
export async function resetDemoPlayer(handle: string, displayName: string): Promise<string> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RESET !== 'true') {
    throw new DomainError('FORBIDDEN', 'Demo reset is disabled in production.')
  }
  // Player deletion cascades to inventory, rigs, jobs, claims, challenges and the ledger.
  await prisma.$transaction([
    prisma.rewardClaim.deleteMany({ where: { player: { handle } } }),
    prisma.miningJob.deleteMany({ where: { player: { handle } } }),
    prisma.player.deleteMany({ where: { handle } }),
  ])
  return provisionPlayer(handle, displayName)
}
