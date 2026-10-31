import { prisma } from '../db'
import { DomainError } from '../errors'
import { adjust, type Tx } from './ledger'
import { levelFromXp, levelProgress } from '@/lib/game/progression'
import type { AchievementSlug } from '@/lib/game/catalog'

/** Add xp and recompute the player's level. Returns the new level. */
export async function addXp(tx: Tx, playerId: string, xp: number): Promise<number> {
  if (xp <= 0) {
    const p = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { level: true } })
    return p.level
  }
  const updated = await tx.player.update({ where: { id: playerId }, data: { xp: { increment: xp } }, select: { xp: true } })
  const level = levelFromXp(updated.xp)
  await tx.player.update({ where: { id: playerId }, data: { level } })
  return level
}

/**
 * Unlock any achievements the player now qualifies for. Each achievement can
 * only ever unlock once (unique index) and pays its credit reward once.
 * Returns the slugs unlocked by this call.
 */
export async function evaluateAchievements(tx: Tx, playerId: string): Promise<string[]> {
  const [player, unlocked, defs, purchases, upgrades, rigs, jobs, optimalJobs, efficientJobs, claims, claimSum] = await Promise.all([
    tx.player.findUniqueOrThrow({ where: { id: playerId } }),
    tx.playerAchievement.findMany({ where: { playerId }, include: { achievement: true } }),
    tx.achievementDefinition.findMany(),
    tx.ledgerEntry.count({ where: { playerId, type: 'PURCHASE' } }),
    tx.ledgerEntry.count({ where: { playerId, type: 'UPGRADE' } }),
    tx.rig.count({ where: { playerId } }),
    tx.miningJob.count({ where: { playerId, status: { not: 'CANCELLED' } } }),
    tx.miningJob.count({ where: { playerId, status: { not: 'CANCELLED' }, optimal: true } }),
    tx.miningJob.count({ where: { playerId, status: { not: 'CANCELLED' }, efficient: true } }),
    tx.rewardClaim.count({ where: { playerId } }),
    tx.rewardClaim.aggregate({ where: { playerId }, _sum: { quantaMilli: true } }),
  ])

  const conditions: Record<AchievementSlug, boolean> = {
    'first-purchase': purchases >= 1,
    'first-rig': rigs >= 2,
    'first-job': jobs >= 1,
    'first-claim': claims >= 1,
    'perfect-solve': optimalJobs >= 1,
    'efficient-miner': efficientJobs >= 1,
    upgrader: upgrades >= 1,
    'level-3': player.level >= 3,
    'level-5': player.level >= 5,
    'quanta-5': (claimSum._sum.quantaMilli ?? 0) >= 5000,
    veteran: claims >= 10,
  }

  const have = new Set(unlocked.map((u) => u.achievement.slug))
  const newly: string[] = []
  for (const def of defs) {
    const ok = (conditions as Record<string, boolean | undefined>)[def.slug]
    if (!ok || have.has(def.slug)) continue
    const created = await tx.playerAchievement.createMany({ data: [{ playerId, achievementId: def.id }], skipDuplicates: true })
    if (created.count === 0) continue
    newly.push(def.slug)
    if (def.rewardCredits > 0) {
      await adjust(tx, playerId, 'CREDITS', def.rewardCredits, {
        type: 'ACHIEVEMENT',
        refType: 'achievement',
        refId: def.slug,
        memo: `Achievement unlocked: ${def.name}`,
        idempotencyKey: `ach:${def.slug}`,
      })
    }
  }
  return newly
}

export async function getProgression(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player) throw new DomainError('NOT_FOUND', 'Player not found.')

  const [defs, unlocked, equipment, challenges] = await Promise.all([
    prisma.achievementDefinition.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.playerAchievement.findMany({ where: { playerId } }),
    prisma.equipmentDefinition.findMany({ where: { requiredLevel: { gt: 1 } }, orderBy: [{ requiredLevel: 'asc' }, { price: 'asc' }] }),
    prisma.challengeDefinition.findMany({ where: { requiredLevel: { gt: 1 } }, orderBy: [{ requiredLevel: 'asc' }, { difficulty: 'asc' }] }),
  ])
  const unlockedAt = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]))

  return {
    progress: levelProgress(player.xp),
    achievements: defs.map((d) => ({
      slug: d.slug,
      name: d.name,
      description: d.description,
      rewardCredits: d.rewardCredits,
      unlockedAt: unlockedAt.get(d.id)?.toISOString() ?? null,
    })),
    unlocks: [
      ...equipment.map((e) => ({ kind: 'equipment' as const, name: e.name, requiredLevel: e.requiredLevel, unlocked: player.level >= e.requiredLevel })),
      ...challenges.map((c) => ({ kind: 'challenge' as const, name: c.name, requiredLevel: c.requiredLevel, unlocked: player.level >= c.requiredLevel })),
    ].sort((a, b) => a.requiredLevel - b.requiredLevel),
  }
}
