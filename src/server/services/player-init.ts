import { prisma } from '../db'
import { DomainError } from '../errors'
import { adjust, type Tx } from './ledger'
import { STARTER_LOADOUT } from '@/lib/game/catalog'
import { STARTING_RESOURCES } from '@/lib/game/config'

/**
 * Create the game state for a new player INSIDE an existing transaction:
 * profile and resources, the starting balances (recorded as GRANT ledger
 * entries so balances reconcile from the first entry), and a ready Starter Rig.
 * Every new player gets exactly the same intended starting economy.
 */
export async function initializePlayer(tx: Tx, input: { userId: string | null; handle: string; displayName: string }): Promise<string> {
  const equipment = await tx.equipmentDefinition.findMany({ where: { slug: { in: [...STARTER_LOADOUT] } } })
  if (equipment.length !== STARTER_LOADOUT.length) {
    throw new DomainError('NOT_FOUND', 'The game catalog is empty. Run `bun run db:seed` first.')
  }

  const player = await tx.player.create({
    data: { userId: input.userId, handle: input.handle, displayName: input.displayName, credits: 0, quantaMilli: 0, energy: 0 },
  })

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
}

/** A player with no login (used by tests and tooling). Real players are created by registration. */
export async function provisionPlayer(handle: string, displayName: string): Promise<string> {
  return prisma.$transaction((tx) => initializePlayer(tx, { userId: null, handle, displayName }))
}
