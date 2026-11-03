import { describe, expect, it } from 'vitest'
import { POST as loginRoute } from '@/app/api/auth/login/route'
import { POST as logoutRoute } from '@/app/api/auth/logout/route'
import { GET as dashboardRoute } from '@/app/api/dashboard/route'
import { GET as inventoryRoute } from '@/app/api/inventory/route'
import { POST as upgradeRoute } from '@/app/api/inventory/[id]/upgrade/route'
import { POST as purchaseRoute } from '@/app/api/marketplace/purchase/route'
import { POST as rechargeRoute } from '@/app/api/energy/recharge/route'
import { GET as rigsRoute } from '@/app/api/rigs/route'
import { POST as generateRoute } from '@/app/api/challenges/route'
import { GET as jobsRoute, POST as startJobRoute } from '@/app/api/jobs/route'
import { GET as jobRoute } from '@/app/api/jobs/[id]/route'
import { POST as claimRoute } from '@/app/api/jobs/[id]/claim/route'
import { POST as cancelRoute } from '@/app/api/jobs/[id]/cancel/route'
import { GET as ledgerRoute } from '@/app/api/ledger/route'
import { prisma } from '@/server/db'
import { solveOptimally } from '@/lib/challenges/solvers'
import { asCookie, call } from './http'
import { definitionId, equipmentId, expectReconciled, registerAccount, type TestAccount } from './helpers'

interface Item {
  id: string
  level: number
  rigId: string | null
  equipment: { slug: string }
}

const snapshot = async (cookie: string) => {
  const [dash, inv] = await Promise.all([call(dashboardRoute, { cookie }), call(inventoryRoute, { cookie })])
  return {
    balances: dash.json.data.balances,
    progress: dash.json.data.progress,
    inventory: (inv.json.data as Item[]).map((i) => `${i.id}:${i.equipment.slug}:L${i.level}:${i.rigId ?? '-'}`).sort(),
  }
}

describe('inventory and resources survive logout and login', () => {
  it('keeps purchases, upgrades, recharged energy and balances on every device', async () => {
    const a = await registerAccount()
    const buy = async (slug: string) => (await call(purchaseRoute, { cookie: a.cookie, body: { equipmentId: await equipmentId(slug) } })).json.data.item.id as string
    const fan = await buy('cool-fan')
    await buy('ram-8')
    const up = await call(upgradeRoute, { cookie: a.cookie, params: { id: fan }, body: {} })
    expect(up.status).toBe(200)
    expect((await call(rechargeRoute, { cookie: a.cookie, body: { packs: 2 } })).status).toBe(200)

    const before = await snapshot(a.cookie)
    expect(before.inventory).toHaveLength(7) // 5 starter parts + 2 purchases
    expect(before.balances.energy).toBe(600)
    expect(before.inventory.some((i) => i.startsWith(`${fan}:cool-fan:L2`))).toBe(true)

    await call(logoutRoute, { cookie: a.cookie, body: { everywhere: true } })
    expect((await call(inventoryRoute, { cookie: a.cookie })).status).toBe(401)

    const first = await call(loginRoute, { body: { identifier: a.username, password: a.password } })
    const second = await call(loginRoute, { body: { identifier: a.email, password: a.password } })
    expect(await snapshot(asCookie(first.sessionCookie) as string)).toEqual(before)
    expect(await snapshot(asCookie(second.sessionCookie) as string)).toEqual(before)
    await expectReconciled(a.playerId)
  })
})

describe('mining through the real endpoints', () => {
  async function startJob(acct: TestAccount, slug = 'route-basic') {
    const gen = await call(generateRoute, { cookie: acct.cookie, body: { definitionId: await definitionId(slug) } })
    const rig = ((await call(rigsRoute, { cookie: acct.cookie })).json.data as Array<{ id: string }>)[0]
    const res = await call(startJobRoute, {
      cookie: acct.cookie,
      body: { rigId: rig?.id, challengeInstanceId: gen.json.data.id, solution: solveOptimally(gen.json.data.payload) },
    })
    expect(res.status).toBe(201)
    return res.json.data as { id: string; energyCost: number; feeCredits: number; rewardMq: number; xpReward: number }
  }
  /** Move a job's timeline into the past so it has finished, as if the time had really passed. */
  const finish = (jobId: string) =>
    prisma.miningJob.update({ where: { id: jobId }, data: { startedAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() - 1_000) } })

  it('a job is stored against its owner, and charges exactly the fee and energy it reports', async () => {
    const a = await registerAccount()
    const b = await registerAccount()
    const job = await startJob(a)
    const row = await prisma.miningJob.findUniqueOrThrow({ where: { id: job.id }, include: { rig: true, challenge: true } })
    expect(row.playerId).toBe(a.playerId)
    expect(row.rig.playerId).toBe(a.playerId)
    expect(row.challenge.playerId).toBe(a.playerId)

    const dash = (await call(dashboardRoute, { cookie: a.cookie })).json.data
    const fee = await prisma.ledgerEntry.findFirstOrThrow({ where: { playerId: a.playerId, type: 'JOB_FEE' } })
    const energy = await prisma.ledgerEntry.findFirstOrThrow({ where: { playerId: a.playerId, type: 'JOB_ENERGY' } })
    expect(fee.amount).toBe(-job.feeCredits)
    expect(energy.amount).toBe(-job.energyCost)
    expect(dash.balances.energy).toBe(400 - job.energyCost)
    // Credits: 1500 - fee, plus the one-time achievement bonuses unlocked by starting a job.
    const bonuses = (await prisma.ledgerEntry.aggregate({ where: { playerId: a.playerId, type: 'ACHIEVEMENT' }, _sum: { amount: true } }))._sum.amount ?? 0
    expect(dash.balances.credits).toBe(1500 - job.feeCredits + bonuses)

    // B is untouched.
    expect((await call(dashboardRoute, { cookie: b.cookie })).json.data.balances).toMatchObject({ credits: 1500, energy: 400 })
    expect((await call(jobsRoute, { cookie: b.cookie })).json.data).toEqual([])
    expect((await call(jobRoute, { cookie: b.cookie, params: { id: job.id } })).status).toBe(404)
  })

  it('credits the exact reward once; a duplicate or racing claim is rejected', async () => {
    const a = await registerAccount()
    const job = await startJob(a)

    const early = await call(claimRoute, { cookie: a.cookie, params: { id: job.id }, body: {} })
    expect(early.status).toBe(409) // still running
    await finish(job.id)

    const results = await Promise.all(Array.from({ length: 5 }, () => call(claimRoute, { cookie: a.cookie, params: { id: job.id }, body: {} })))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(4)

    const dash = (await call(dashboardRoute, { cookie: a.cookie })).json.data
    expect(dash.balances.quantaMilli).toBe(job.rewardMq)
    expect(dash.progress.xp).toBe(job.xpReward)
    expect(await prisma.rewardClaim.count({ where: { playerId: a.playerId } })).toBe(1)
    const entries = await prisma.ledgerEntry.findMany({ where: { playerId: a.playerId, type: 'REWARD_CLAIM' } })
    expect(entries.map((e) => e.amount)).toEqual([job.rewardMq])

    // And again later: still rejected, balance unchanged.
    expect((await call(claimRoute, { cookie: a.cookie, params: { id: job.id }, body: {} })).status).toBe(409)
    expect((await call(dashboardRoute, { cookie: a.cookie })).json.data.balances.quantaMilli).toBe(job.rewardMq)

    const ledger = await call(ledgerRoute, { cookie: a.cookie })
    expect(ledger.json.data.reconciliation.every((r: { reconciled: boolean }) => r.reconciled)).toBe(true)
  })

  it('cancelling refunds the unspent energy exactly and nothing else', async () => {
    const a = await registerAccount()
    const job = await startJob(a)
    // Halfway through the run.
    const total = 20_000
    await prisma.miningJob.update({ where: { id: job.id }, data: { startedAt: new Date(Date.now() - total / 2), endsAt: new Date(Date.now() + total / 2) } })
    const res = await call(cancelRoute, { cookie: a.cookie, params: { id: job.id }, body: {} })
    expect(res.status).toBe(200)
    const refund = (await prisma.ledgerEntry.findFirstOrThrow({ where: { playerId: a.playerId, type: 'JOB_REFUND' } })).amount
    expect(refund).toBeGreaterThanOrEqual(Math.floor(job.energyCost / 2) - 1)
    expect(refund).toBeLessThanOrEqual(Math.floor(job.energyCost / 2) + 1)
    expect((await call(dashboardRoute, { cookie: a.cookie })).json.data.balances.energy).toBe(400 - job.energyCost + refund)
    expect((await call(cancelRoute, { cookie: a.cookie, params: { id: job.id }, body: {} })).status).toBe(409)
    await expectReconciled(a.playerId)
  })

  it('rewards for one player never reach another, even with identical puzzles', async () => {
    const a = await registerAccount()
    const b = await registerAccount()
    const [jobA, jobB] = [await startJob(a), await startJob(b)]
    await Promise.all([finish(jobA.id), finish(jobB.id)])
    expect((await call(claimRoute, { cookie: a.cookie, params: { id: jobB.id }, body: {} })).status).toBe(404)
    expect((await call(claimRoute, { cookie: a.cookie, params: { id: jobA.id }, body: {} })).status).toBe(200)
    expect((await call(dashboardRoute, { cookie: b.cookie })).json.data.balances.quantaMilli).toBe(0)
    expect((await call(claimRoute, { cookie: b.cookie, params: { id: jobB.id }, body: {} })).status).toBe(200)
    expect((await call(dashboardRoute, { cookie: b.cookie })).json.data.balances.quantaMilli).toBe(jobB.rewardMq)
    await Promise.all([expectReconciled(a.playerId), expectReconciled(b.playerId)])
  })
})
