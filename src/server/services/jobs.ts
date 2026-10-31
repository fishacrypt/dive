import type { ChallengeDefinition, MiningJob } from '@prisma/client'
import { prisma } from '../db'
import { DomainError, notFound } from '../errors'
import { adjust, namespaced, type Tx } from './ledger'
import { addXp, evaluateAchievements } from './progression'
import { lockRig, toRigPart } from './rigs'
import { readPayload } from './challenges'
import { evaluateSolution } from '@/lib/challenges/evaluate'
import type { Solution } from '@/lib/challenges/types'
import { computeReward } from '@/lib/game/progression'
import { checkRigMeetsChallenge, computeRigStats, planJob } from '@/lib/game/rig'

export type Clock = () => Date
const systemClock: Clock = () => new Date()

type JobWithRefs = MiningJob & { challenge: { definition: ChallengeDefinition }; rig: { name: string } }

export function serializeJob(job: JobWithRefs, now: Date) {
  const total = job.endsAt.getTime() - job.startedAt.getTime()
  const elapsed = now.getTime() - job.startedAt.getTime()
  const done = job.status !== 'RUNNING' && job.status !== 'CANCELLED'
  const progress = job.status === 'RUNNING' ? Math.min(1, Math.max(0, elapsed / total)) : done ? 1 : 0
  return {
    id: job.id,
    status: job.status,
    rigId: job.rigId,
    rigName: job.rig.name,
    challengeName: job.challenge.definition.name,
    challengeType: job.challenge.definition.type,
    difficulty: job.challenge.definition.difficulty,
    startedAt: job.startedAt.toISOString(),
    endsAt: job.endsAt.toISOString(),
    durationSec: job.durationSec,
    remainingSec: job.status === 'RUNNING' ? Math.max(0, Math.ceil((job.endsAt.getTime() - now.getTime()) / 1000)) : 0,
    progress,
    energyCost: job.energyCost,
    feeCredits: job.feeCredits,
    effectiveCompute: job.effectiveCompute,
    optimal: job.optimal,
    efficient: job.efficient,
    rewardMq: job.rewardMq,
    xpReward: job.xpReward,
    claimedAt: job.claimedAt?.toISOString() ?? null,
  }
}

const jobInclude = { challenge: { include: { definition: true } }, rig: { select: { name: true } } } as const

/**
 * Request-driven settlement: any RUNNING job whose end time has passed becomes
 * COMPLETED. Called whenever jobs are read or claimed, so state is always
 * correct without a background worker. Idempotent and safe to run concurrently.
 */
export async function settleDueJobs(playerId: string, now: Date = systemClock(), db: Tx | typeof prisma = prisma): Promise<number> {
  const result = await db.miningJob.updateMany({
    where: { playerId, status: 'RUNNING', endsAt: { lte: now } },
    data: { status: 'COMPLETED', settledAt: now },
  })
  return result.count
}

export async function listJobs(playerId: string, now: Date = systemClock()) {
  await settleDueJobs(playerId, now)
  const jobs = await prisma.miningJob.findMany({ where: { playerId }, include: jobInclude, orderBy: { createdAt: 'desc' }, take: 100 })
  return jobs.map((j) => serializeJob(j, now))
}

export async function getJob(playerId: string, jobId: string, now: Date = systemClock()) {
  await settleDueJobs(playerId, now)
  const job = await prisma.miningJob.findFirst({ where: { id: jobId, playerId }, include: jobInclude })
  if (!job) throw notFound('Job')
  return serializeJob(job, now)
}

export interface StartJobInput {
  rigId: string
  challengeInstanceId: string
  solution: Solution
  idempotencyKey?: string
}

/**
 * Validate the solution, charge the entry fee and energy, and start a persistent job.
 * Everything that matters (rig stats, duration, energy, reward) is recomputed
 * on the server. An invalid solution rejects the request before anything is charged.
 */
export async function startJob(playerId: string, input: StartJobInput, now: Date = systemClock()) {
  const key = namespaced('job', input.idempotencyKey)
  await settleDueJobs(playerId, now)
  try {
    const jobId = await prisma.$transaction(async (tx) => {
      // Take the rig lock first: a concurrent request with the same key waits here,
      // then finds the first request's job in the idempotency check below.
      await lockRig(tx, playerId, input.rigId)
      if (key) {
        const prior = await tx.miningJob.findFirst({ where: { playerId, idempotencyKey: input.idempotencyKey } })
        if (prior) return prior.id
      }

      const instance = await tx.challengeInstance.findFirst({
        where: { id: input.challengeInstanceId, playerId },
        include: { definition: true },
      })
      if (!instance) throw notFound('Challenge')
      if (instance.status !== 'OPEN') throw new DomainError('INVALID_STATE', 'That challenge has already been used.')
      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { level: true } })
      if (player.level < instance.definition.requiredLevel) {
        throw new DomainError('LEVEL_LOCKED', `Requires level ${instance.definition.requiredLevel}.`)
      }

      const busy = await tx.miningJob.findFirst({ where: { rigId: input.rigId, status: 'RUNNING' }, select: { id: true } })
      if (busy) throw new DomainError('INVALID_STATE', 'This rig is already running a job.')

      const components = await tx.rigComponent.findMany({
        where: { rigId: input.rigId },
        include: { item: { include: { equipment: true } } },
      })
      const stats = computeRigStats(components.map((c) => toRigPart(c.item)))
      const incompatible = checkRigMeetsChallenge(stats, instance.definition)
      if (incompatible) throw new DomainError('INCOMPATIBLE', incompatible)

      const verdict = evaluateSolution(readPayload(instance), input.solution)
      if (!verdict.valid) throw new DomainError('INVALID_SOLUTION', verdict.reason ?? 'The solution is not valid.')

      const plan = planJob(stats, instance.definition.workUnits)
      const efficient = plan.energyCost <= instance.definition.energyPar
      const reward = computeReward({
        baseRewardMq: instance.definition.baseRewardMq,
        xpReward: instance.definition.xpReward,
        optimal: verdict.optimal,
        efficient,
      })

      // Claim the puzzle atomically: a second request for the same puzzle finds count 0.
      const used = await tx.challengeInstance.updateMany({ where: { id: instance.id, status: 'OPEN' }, data: { status: 'USED' } })
      if (used.count === 0) throw new DomainError('CONFLICT', 'That challenge was just used by another request.')

      const job = await tx.miningJob.create({
        data: {
          playerId,
          rigId: input.rigId,
          challengeInstanceId: instance.id,
          status: 'RUNNING',
          startedAt: now,
          endsAt: new Date(now.getTime() + plan.durationSec * 1000),
          durationSec: plan.durationSec,
          energyCost: plan.energyCost,
          feeCredits: instance.definition.feeCredits,
          effectiveCompute: stats.effectiveCompute,
          optimal: verdict.optimal,
          efficient,
          rewardMq: reward.rewardMq,
          xpReward: reward.xp,
          idempotencyKey: input.idempotencyKey,
        },
      })

      await adjust(tx, playerId, 'CREDITS', -instance.definition.feeCredits, {
        type: 'JOB_FEE',
        refType: 'job',
        refId: job.id,
        memo: `Entry fee: ${instance.definition.name}`,
        idempotencyKey: key ? `${key}:fee` : undefined,
      })
      await adjust(tx, playerId, 'ENERGY', -plan.energyCost, {
        type: 'JOB_ENERGY',
        refType: 'job',
        refId: job.id,
        memo: `Energy for ${instance.definition.name} (${plan.durationSec}s)`,
        idempotencyKey: key ? `${key}:energy` : undefined,
      })
      await evaluateAchievements(tx, playerId)
      return job.id
    })
    return await getJob(playerId, jobId, now)
  } catch (error) {
    if (key && isUniqueViolation(error)) {
      const prior = await prisma.miningJob.findFirst({ where: { playerId, idempotencyKey: input.idempotencyKey } })
      if (prior) return getJob(playerId, prior.id, now)
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
}

/** Cancel a job that is still running. Unspent energy is refunded; the fee is not. */
export async function cancelJob(playerId: string, jobId: string, now: Date = systemClock()) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.miningJob.findFirst({ where: { id: jobId, playerId } })
    if (!job) throw notFound('Job')
    if (job.status !== 'RUNNING') throw new DomainError('INVALID_STATE', `A ${job.status.toLowerCase()} job cannot be cancelled.`)
    if (job.endsAt <= now) throw new DomainError('INVALID_STATE', 'This job already finished. Claim its reward instead.')

    const moved = await tx.miningJob.updateMany({
      where: { id: job.id, status: 'RUNNING', endsAt: { gt: now } },
      data: { status: 'CANCELLED', cancelledAt: now },
    })
    if (moved.count === 0) throw new DomainError('INVALID_STATE', 'This job can no longer be cancelled.')

    const total = job.endsAt.getTime() - job.startedAt.getTime()
    const remaining = job.endsAt.getTime() - now.getTime()
    const refund = Math.floor((job.energyCost * remaining) / total)
    await adjust(tx, playerId, 'ENERGY', refund, {
      type: 'JOB_REFUND',
      refType: 'job',
      refId: job.id,
      memo: 'Energy refund for cancelled job',
      idempotencyKey: `cancel:${job.id}`,
    })
    // Hand the unused puzzle back so the player can try again.
    await tx.challengeInstance.update({ where: { id: job.challengeInstanceId }, data: { status: 'OPEN' } })
  })
  return getJob(playerId, jobId, now)
}

/** Claim the reward of a completed job exactly once. */
export async function claimJob(playerId: string, jobId: string, now: Date = systemClock()) {
  await settleDueJobs(playerId, now)
  const result = await prisma.$transaction(async (tx) => {
    // The state change is the lock: only one concurrent request can move COMPLETED -> CLAIMED.
    const moved = await tx.miningJob.updateMany({
      where: { id: jobId, playerId, status: 'COMPLETED' },
      data: { status: 'CLAIMED', claimedAt: now },
    })
    if (moved.count === 0) {
      const job = await tx.miningJob.findFirst({ where: { id: jobId, playerId } })
      if (!job) throw notFound('Job')
      if (job.status === 'CLAIMED') throw new DomainError('CONFLICT', 'This reward was already claimed.')
      if (job.status === 'RUNNING') throw new DomainError('INVALID_STATE', 'This job is still running. Wait for it to finish.')
      throw new DomainError('INVALID_STATE', 'A cancelled job has no reward.')
    }
    const job = await tx.miningJob.findUniqueOrThrow({ where: { id: jobId } })
    await tx.rewardClaim.create({ data: { jobId, playerId, quantaMilli: job.rewardMq, xp: job.xpReward } })
    await adjust(tx, playerId, 'QUANTA', job.rewardMq, {
      type: 'REWARD_CLAIM',
      refType: 'job',
      refId: job.id,
      memo: 'Simulated Quanta reward',
      idempotencyKey: `claim:${job.id}`,
    })
    const level = await addXp(tx, playerId, job.xpReward)
    const achievements = await evaluateAchievements(tx, playerId)
    return { rewardMq: job.rewardMq, xp: job.xpReward, level, achievements }
  })
  return { ...result, job: await getJob(playerId, jobId, now) }
}
