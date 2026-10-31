import { describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'
import { cancelJob, claimJob, getJob, listJobs, startJob } from '@/server/services/jobs'
import { createRig, listRigs } from '@/server/services/rigs'
import { generateChallenge } from '@/lib/challenges/generate'
import { chromaticNumber, solveOptimally } from '@/lib/challenges/solvers'
import type { ColoringPayload, Solution } from '@/lib/challenges/types'
import { equipmentId, expectReconciled, newPlayer, openChallenge, setBalances } from './helpers'
import { purchaseEquipment } from '@/server/services/marketplace'

const seconds = (n: number) => n * 1000

async function starterRigId(playerId: string): Promise<string> {
  return (await listRigs(playerId))[0]?.id as string
}

/** Start the standard job (route-basic, optimal solution) on the starter rig. */
async function startStandardJob(playerId: string, now = new Date(), seed = 12345, extra: { idempotencyKey?: string } = {}) {
  const inst = await openChallenge(playerId, 'route-basic', seed)
  const solution = solveOptimally(inst.payload)
  const job = await startJob(playerId, { rigId: await starterRigId(playerId), challengeInstanceId: inst.id, solution, ...extra }, now)
  return { inst, solution, job }
}

describe('starting jobs', () => {
  it('validates the solution, charges fee and energy, and persists a running job', async () => {
    const id = await newPlayer()
    const now = new Date()
    const { job } = await startStandardJob(id, now)
    expect(job).toMatchObject({ status: 'RUNNING', durationSec: 20, energyCost: 60, feeCredits: 10, optimal: true, efficient: false })
    // 800 mQ base * (1 + 25% optimal bonus), 60 XP * 1.25
    expect(job.rewardMq).toBe(1000)
    expect(job.xpReward).toBe(75)
    const p = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(p.energy).toBe(400 - 60)
    const types = (await prisma.ledgerEntry.findMany({ where: { playerId: id, type: { in: ['JOB_FEE', 'JOB_ENERGY'] } } })).map((e) => `${e.type}:${e.amount}`).sort()
    expect(types).toEqual(['JOB_ENERGY:-60', 'JOB_FEE:-10'])
    await expectReconciled(id)
  })

  it('rejects an invalid solution without charging anything and keeps the challenge open', async () => {
    const id = await newPlayer()
    const inst = await openChallenge(id, 'route-basic')
    const before = await prisma.player.findUniqueOrThrow({ where: { id } })
    const bad: Solution = { type: 'PATH', path: [0, 1] }
    await expect(startJob(id, { rigId: await starterRigId(id), challengeInstanceId: inst.id, solution: bad })).rejects.toMatchObject({ code: 'INVALID_SOLUTION' })
    const after = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(after.credits).toBe(before.credits)
    expect(after.energy).toBe(before.energy)
    expect((await prisma.challengeInstance.findUniqueOrThrow({ where: { id: inst.id } })).status).toBe('OPEN')
    expect(await prisma.miningJob.count({ where: { playerId: id } })).toBe(0)
  })

  it('rejects rigs that do not meet the challenge requirements', async () => {
    const id = await newPlayer()
    await setBalances(id, { level: 2 })
    const inst = await openChallenge(id, 'span-basic') // needs 30 compute; starter rig has 10
    await expect(
      startJob(id, { rigId: await starterRigId(id), challengeInstanceId: inst.id, solution: solveOptimally(inst.payload) }),
    ).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
  })

  it('rejects incomplete rigs', async () => {
    const id = await newPlayer()
    const empty = await createRig(id, 'Empty')
    const inst = await openChallenge(id, 'route-basic')
    await expect(startJob(id, { rigId: empty.id, challengeInstanceId: inst.id, solution: solveOptimally(inst.payload) })).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
  })

  it('rolls everything back when energy is insufficient', async () => {
    const id = await newPlayer({ energy: 10 })
    const inst = await openChallenge(id, 'route-basic')
    await expect(
      startJob(id, { rigId: await starterRigId(id), challengeInstanceId: inst.id, solution: solveOptimally(inst.payload) }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    const p = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(p).toMatchObject({ credits: 1500, energy: 10 })
    expect((await prisma.challengeInstance.findUniqueOrThrow({ where: { id: inst.id } })).status).toBe('OPEN')
    await expectReconciled(id)
  })

  it('enforces ownership of rigs and challenges', async () => {
    const a = await newPlayer()
    const b = await newPlayer()
    const instA = await openChallenge(a, 'route-basic')
    await expect(startJob(b, { rigId: await starterRigId(b), challengeInstanceId: instA.id, solution: solveOptimally(instA.payload) })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const instB = await openChallenge(b, 'route-basic')
    await expect(startJob(b, { rigId: await starterRigId(a), challengeInstanceId: instB.id, solution: solveOptimally(instB.payload) })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('enforces level-locked challenges', async () => {
    const id = await newPlayer()
    const { generateInstance } = await import('@/server/services/challenges')
    const def = await prisma.challengeDefinition.findUniqueOrThrow({ where: { slug: 'span-hard' } })
    await expect(generateInstance(id, def.id)).rejects.toMatchObject({ code: 'LEVEL_LOCKED' })
  })

  it('allows only one running job per rig, and a challenge can be used once', async () => {
    const id = await newPlayer()
    await startStandardJob(id)
    const second = await openChallenge(id, 'route-basic', 999)
    await expect(
      startJob(id, { rigId: await starterRigId(id), challengeInstanceId: second.id, solution: solveOptimally(second.payload) }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' })
    const used = await prisma.miningJob.findFirstOrThrow({ where: { playerId: id } })
    await expect(
      startJob(id, { rigId: await starterRigId(id), challengeInstanceId: used.challengeInstanceId, solution: { type: 'PATH', path: [] } }),
    ).rejects.toBeDefined()
  })

  it('parallel starts on one rig create exactly one job and charge once', async () => {
    const id = await newPlayer()
    const rigId = await starterRigId(id)
    const insts = await Promise.all([1, 2, 3, 4].map((n) => openChallenge(id, 'route-basic', 100 + n)))
    const results = await Promise.allSettled(insts.map((inst) => startJob(id, { rigId, challengeInstanceId: inst.id, solution: solveOptimally(inst.payload) })))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.miningJob.count({ where: { playerId: id, status: 'RUNNING' } })).toBe(1)
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).energy).toBe(340)
    await expectReconciled(id)
  })

  it('is idempotent for a repeated key', async () => {
    const id = await newPlayer()
    const inst = await openChallenge(id, 'route-basic')
    const input = { rigId: await starterRigId(id), challengeInstanceId: inst.id, solution: solveOptimally(inst.payload), idempotencyKey: 'job-key-000001' }
    const [a, b] = await Promise.all([startJob(id, input), startJob(id, input)])
    expect(a.id).toBe(b.id)
    expect(await prisma.miningJob.count({ where: { playerId: id } })).toBe(1)
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).energy).toBe(340)
    await expectReconciled(id)
  })

  it('gives no optimal bonus for a valid but wasteful solution', async () => {
    const id = await newPlayer()
    const inst = await openChallenge(id, 'color-basic', 4242)
    const payload = generateChallenge('COLORING', 4242, 8) as ColoringPayload
    const chi = chromaticNumber(payload.nodes.length, payload.edges)
    const colors = chi.colors.slice()
    colors[colors.findIndex((c) => colors.filter((x) => x === c).length > 1)] = payload.colors - 1
    const job = await startJob(id, { rigId: await starterRigId(id), challengeInstanceId: inst.id, solution: { type: 'COLORING', colors } })
    expect(job.optimal).toBe(false)
    expect(job.rewardMq).toBe(900)
  })

  it('computes identical rewards for identical inputs (deterministic)', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()]
    const first = await startStandardJob(a, new Date(), 31337)
    const second = await startStandardJob(b, new Date(), 31337)
    expect({ r: first.job.rewardMq, x: first.job.xpReward, d: first.job.durationSec, e: first.job.energyCost }).toEqual({
      r: second.job.rewardMq,
      x: second.job.xpReward,
      d: second.job.durationSec,
      e: second.job.energyCost,
    })
  })
})

describe('job lifecycle', () => {
  it('persists across refreshes and settles by elapsed time', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    const mid = await listJobs(id, new Date(t0.getTime() + seconds(5)))
    expect(mid[0]).toMatchObject({ id: job.id, status: 'RUNNING' })
    expect(mid[0]?.progress).toBeCloseTo(0.25, 1)
    const done = await getJob(id, job.id, new Date(t0.getTime() + seconds(21)))
    expect(done).toMatchObject({ status: 'COMPLETED', progress: 1 })
  })

  it('refuses a premature claim', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    await expect(claimJob(id, job.id, new Date(t0.getTime() + seconds(5)))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).quantaMilli).toBe(0)
  })

  it('pays the reward once, awards XP and achievements, and keeps the ledger reconciled', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    const claim = await claimJob(id, job.id, new Date(t0.getTime() + seconds(25)))
    expect(claim.rewardMq).toBe(1000)
    expect(claim.achievements).toEqual(expect.arrayContaining(['first-claim']))
    const p = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(p.quantaMilli).toBe(1000)
    expect(p.xp).toBe(75)
    const unlocked = await prisma.playerAchievement.findMany({ where: { playerId: id }, include: { achievement: true } })
    expect(unlocked.map((u) => u.achievement.slug)).toEqual(expect.arrayContaining(['first-job', 'first-claim', 'perfect-solve']))
    await expectReconciled(id)
  })

  it('rejects a duplicate claim', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    const later = new Date(t0.getTime() + seconds(25))
    await claimJob(id, job.id, later)
    await expect(claimJob(id, job.id, later)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).quantaMilli).toBe(1000)
    expect(await prisma.rewardClaim.count({ where: { playerId: id } })).toBe(1)
  })

  it('pays only once when claims race', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    const later = new Date(t0.getTime() + seconds(25))
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => claimJob(id, job.id, later)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await prisma.player.findUniqueOrThrow({ where: { id } })).quantaMilli).toBe(1000)
    await expectReconciled(id)
  })

  it('refunds unspent energy on cancel, keeps the fee, and reopens the challenge', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job, inst } = await startStandardJob(id, t0)
    const cancelled = await cancelJob(id, job.id, new Date(t0.getTime() + seconds(10)))
    expect(cancelled.status).toBe('CANCELLED')
    const p = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(p.energy).toBe(400 - 60 + 30) // half the time left => half the energy back
    // Fee is not refunded; +100 is the one-time first-job and perfect-solve achievement bonuses.
    expect(p.credits).toBe(1500 - 10 + 100)
    expect((await prisma.challengeInstance.findUniqueOrThrow({ where: { id: inst.id } })).status).toBe('OPEN')
    await expectReconciled(id)
    // The rig is free again and a cancelled job has no reward.
    await expect(claimJob(id, job.id, new Date(t0.getTime() + seconds(30)))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expect(cancelJob(id, job.id, new Date(t0.getTime() + seconds(11)))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('cannot cancel a finished job, nor someone else\'s job', async () => {
    const id = await newPlayer()
    const other = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    await expect(cancelJob(other, job.id, t0)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(claimJob(other, job.id, new Date(t0.getTime() + seconds(30)))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(cancelJob(id, job.id, new Date(t0.getTime() + seconds(25)))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('locks a rig while a job runs and releases it afterwards', async () => {
    const id = await newPlayer()
    const t0 = new Date()
    const { job } = await startStandardJob(id, t0)
    const { assignComponent } = await import('@/server/services/rigs')
    const spare = await purchaseEquipment(id, await equipmentId('cool-fan'))
    await expect(assignComponent(id, await starterRigId(id), spare.item.id)).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await claimJob(id, job.id, new Date(t0.getTime() + seconds(30)))
    await expect(assignComponent(id, await starterRigId(id), spare.item.id)).resolves.toBeDefined()
  })
})

describe('end-to-end game loop (service level)', () => {
  it('buy, build, solve, run, claim, and reconcile everything', async () => {
    const id = await newPlayer()
    await setBalances(id, { level: 3 })
    // Buy and build a stronger rig.
    const rig = await createRig(id, 'Loop Rig')
    const { assignComponent } = await import('@/server/services/rigs')
    for (const slug of ['chassis-starter', 'cpu-pulse', 'gpu-spark', 'ram-16', 'cool-liquid', 'psu-300']) {
      const bought = await purchaseEquipment(id, await equipmentId(slug))
      await assignComponent(id, rig.id, bought.item.id)
    }
    const built = (await listRigs(id)).find((r) => r.id === rig.id)
    expect(built?.stats.ready).toBe(true)
    expect(built?.stats.effectiveCompute).toBe(40)
    // Solve an allocation puzzle, run it, claim it.
    const inst = await openChallenge(id, 'pack-basic', 2024)
    const t0 = new Date()
    const job = await startJob(id, { rigId: rig.id, challengeInstanceId: inst.id, solution: solveOptimally(inst.payload) }, t0)
    expect(job.status).toBe('RUNNING')
    expect(job.durationSec).toBe(6) // ceil(210 / 40)
    const claim = await claimJob(id, job.id, new Date(t0.getTime() + seconds(7)))
    expect(claim.job.status).toBe('CLAIMED')
    const p = await prisma.player.findUniqueOrThrow({ where: { id } })
    expect(p.quantaMilli).toBe(claim.rewardMq)
    expect(p.xp).toBeGreaterThan(0)
    await expectReconciled(id)
    const types = new Set((await prisma.ledgerEntry.findMany({ where: { playerId: id } })).map((e) => e.type))
    for (const t of ['GRANT', 'PURCHASE', 'JOB_FEE', 'JOB_ENERGY', 'REWARD_CLAIM', 'ACHIEVEMENT']) expect(types.has(t as never)).toBe(true)
  })
})
