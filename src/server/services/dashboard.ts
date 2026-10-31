import { prisma } from '../db'
import { DomainError } from '../errors'
import { reconcile } from './ledger'
import { listJobs, settleDueJobs } from './jobs'
import { listRigs } from './rigs'
import { ENERGY, REFINERY, SIMULATION_NOTICE } from '@/lib/game/config'
import { levelProgress } from '@/lib/game/progression'

export async function getDashboard(playerId: string, now: Date = new Date()) {
  await settleDueJobs(playerId, now)
  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player) throw new DomainError('NOT_FOUND', 'Player not found.')

  const [rigs, jobs, recent, reconciliation, openChallenges, unlockedAchievements, totalAchievements, claimed] = await Promise.all([
    listRigs(playerId),
    listJobs(playerId, now),
    prisma.ledgerEntry.findMany({ where: { playerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 6 }),
    reconcile(playerId),
    prisma.challengeInstance.count({ where: { playerId, status: 'OPEN' } }),
    prisma.playerAchievement.count({ where: { playerId } }),
    prisma.achievementDefinition.count(),
    prisma.rewardClaim.aggregate({ where: { playerId }, _sum: { quantaMilli: true }, _count: { _all: true } }),
  ])

  return {
    notice: SIMULATION_NOTICE,
    player: { id: player.id, displayName: player.displayName, handle: player.handle },
    balances: { credits: player.credits, quantaMilli: player.quantaMilli, energy: player.energy, energyCap: ENERGY.cap },
    rules: {
      creditsPerQuanta: REFINERY.creditsPerQuanta,
      energyPerPack: ENERGY.perPack,
      creditsPerPack: ENERGY.creditsPerPack,
    },
    progress: levelProgress(player.xp),
    rigs: rigs.map((r) => ({ id: r.id, name: r.name, busy: r.busy, ready: r.stats.ready, effectiveCompute: r.stats.effectiveCompute, powerDraw: r.stats.powerDraw })),
    activeJobs: jobs.filter((j) => j.status === 'RUNNING' || j.status === 'COMPLETED'),
    totals: {
      openChallenges,
      jobsClaimed: claimed._count._all,
      quantaEarnedMilli: claimed._sum.quantaMilli ?? 0,
      achievementsUnlocked: unlockedAchievements,
      achievementsTotal: totalAchievements,
    },
    recentLedger: recent.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      type: e.type,
      resource: e.resource,
      amount: e.amount,
      memo: e.memo,
    })),
    reconciled: reconciliation.every((r) => r.reconciled),
  }
}
