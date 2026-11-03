import { beforeAll, describe, expect, it } from 'vitest'
import { GET as dashboardRoute } from '@/app/api/dashboard/route'
import { GET as inventoryRoute } from '@/app/api/inventory/route'
import { GET as ledgerRoute } from '@/app/api/ledger/route'
import { GET as marketRoute } from '@/app/api/marketplace/route'
import { POST as purchaseRoute } from '@/app/api/marketplace/purchase/route'
import { POST as upgradeRoute } from '@/app/api/inventory/[id]/upgrade/route'
import { GET as rigsRoute, POST as createRigRoute } from '@/app/api/rigs/route'
import { GET as rigRoute, PATCH as renameRigRoute, DELETE as deleteRigRoute } from '@/app/api/rigs/[id]/route'
import { POST as assignRoute } from '@/app/api/rigs/[id]/components/route'
import { DELETE as removeRoute } from '@/app/api/rigs/[id]/components/[itemId]/route'
import { GET as challengesRoute, POST as generateRoute } from '@/app/api/challenges/route'
import { POST as checkRoute } from '@/app/api/challenges/[id]/check/route'
import { GET as jobsRoute, POST as startJobRoute } from '@/app/api/jobs/route'
import { GET as jobRoute } from '@/app/api/jobs/[id]/route'
import { POST as claimRoute } from '@/app/api/jobs/[id]/claim/route'
import { POST as cancelRoute } from '@/app/api/jobs/[id]/cancel/route'
import { POST as rechargeRoute } from '@/app/api/energy/recharge/route'
import { POST as loginRoute } from '@/app/api/auth/login/route'
import { GET as progressionRoute } from '@/app/api/progression/route'
import { prisma } from '@/server/db'
import { claimJob } from '@/server/services/jobs'
import { solveOptimally } from '@/lib/challenges/solvers'
import { asCookie, call } from './http'
import { definitionId, equipmentId, expectReconciled, registerAccount, type TestAccount } from './helpers'

interface Rig {
  id: string
  name: string
  components: Array<{ itemId: string }>
}

let A: TestAccount
let B: TestAccount

beforeAll(async () => {
  A = await registerAccount()
  B = await registerAccount()
})

describe('two players start independent', () => {
  it('have separate identities, resources, rigs and ledgers', async () => {
    expect(A.playerId).not.toBe(B.playerId)
    const [da, db] = await Promise.all([call(dashboardRoute, { cookie: A.cookie }), call(dashboardRoute, { cookie: B.cookie })])
    expect(da.json.data.player.username).toBe(A.username)
    expect(db.json.data.player.username).toBe(B.username)
    for (const d of [da, db]) expect(d.json.data.balances).toMatchObject({ credits: 1500, energy: 400, quantaMilli: 0 })
    const [ra, rb] = await Promise.all([call(rigsRoute, { cookie: A.cookie }), call(rigsRoute, { cookie: B.cookie })])
    const rigIdsA = (ra.json.data as Rig[]).map((r) => r.id)
    const rigIdsB = (rb.json.data as Rig[]).map((r) => r.id)
    expect(rigIdsA).toHaveLength(1)
    expect(rigIdsB).toHaveLength(1)
    expect(rigIdsA[0]).not.toBe(rigIdsB[0])
    const [la, lb] = await Promise.all([call(ledgerRoute, { cookie: A.cookie }), call(ledgerRoute, { cookie: B.cookie })])
    const ids = new Set([...la.json.data.entries, ...lb.json.data.entries].map((e: { id: string }) => e.id))
    expect(ids.size).toBe(la.json.data.entries.length + lb.json.data.entries.length)
  })

  it('the former shared demo record is not reachable by any account', async () => {
    const legacy = await prisma.player.findFirst({ where: { userId: null } })
    for (const acct of [A, B]) {
      const inv = await call(inventoryRoute, { cookie: acct.cookie })
      expect(JSON.stringify(inv.json)).not.toContain(legacy?.id ?? 'no-legacy-record')
    }
  })
})

describe('purchases, inventory and balances are independent', () => {
  it("A's purchase changes nothing for B", async () => {
    const before = await call(dashboardRoute, { cookie: B.cookie })
    const buy = await call(purchaseRoute, { cookie: A.cookie, body: { equipmentId: await equipmentId('cpu-pulse') } })
    expect(buy.status).toBe(201)
    const [invA, invB, dashA, dashB] = await Promise.all([
      call(inventoryRoute, { cookie: A.cookie }),
      call(inventoryRoute, { cookie: B.cookie }),
      call(dashboardRoute, { cookie: A.cookie }),
      call(dashboardRoute, { cookie: B.cookie }),
    ])
    expect(invA.json.data).toHaveLength(6)
    expect(invB.json.data).toHaveLength(5)
    expect(dashB.json.data.balances).toEqual(before.json.data.balances)
    expect(dashA.json.data.balances.credits).toBeLessThan(1500)
    const idsA = new Set(invA.json.data.map((i: { id: string }) => i.id))
    expect(invB.json.data.some((i: { id: string }) => idsA.has(i.id))).toBe(false)
    await Promise.all([expectReconciled(A.playerId), expectReconciled(B.playerId)])
  })

  it('a client cannot choose whose credits are spent: extra playerId/userId fields are ignored', async () => {
    const beforeA = (await call(dashboardRoute, { cookie: A.cookie })).json.data.balances.credits
    const beforeB = (await call(dashboardRoute, { cookie: B.cookie })).json.data.balances.credits
    const res = await call(purchaseRoute, {
      cookie: B.cookie,
      body: { equipmentId: await equipmentId('ram-8'), playerId: A.playerId, userId: A.playerId },
      headers: { 'x-player-id': A.playerId },
    })
    expect(res.status).toBe(201)
    const afterA = (await call(dashboardRoute, { cookie: A.cookie })).json.data.balances.credits
    const afterB = (await call(dashboardRoute, { cookie: B.cookie })).json.data.balances.credits
    expect(afterA).toBe(beforeA)
    expect(afterB).toBeLessThan(beforeB)
  })

  it("the same idempotency key used by two players never leaks or merges purchases", async () => {
    const eq = await equipmentId('ram-8')
    const key = 'shared-key-between-players-1'
    const [a, b] = await Promise.all([
      call(purchaseRoute, { cookie: A.cookie, body: { equipmentId: eq, idempotencyKey: key } }),
      call(purchaseRoute, { cookie: B.cookie, body: { equipmentId: eq, idempotencyKey: key } }),
    ])
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(a.json.data.item.id).not.toBe(b.json.data.item.id)
    expect(a.json.data.replayed).toBe(false)
    expect(b.json.data.replayed).toBe(false)
  })

  it("B cannot upgrade A's item", async () => {
    const invA = (await call(inventoryRoute, { cookie: A.cookie })).json.data as Array<{ id: string; level: number }>
    const target = invA[0] as { id: string; level: number }
    const res = await call(upgradeRoute, { cookie: B.cookie, params: { id: target.id }, body: {} })
    expect(res.status).toBe(404)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: target.id } })).level).toBe(target.level)
  })

  it('refills energy only for the caller', async () => {
    const energyA = (await call(dashboardRoute, { cookie: A.cookie })).json.data.balances.energy
    await call(rechargeRoute, { cookie: B.cookie, body: { packs: 1 } })
    expect((await call(dashboardRoute, { cookie: A.cookie })).json.data.balances.energy).toBe(energyA)
  })
})

describe("A's rigs are untouchable for B", () => {
  it('B gets 404 for every rig operation on A\'s rig', async () => {
    const rigA = ((await call(rigsRoute, { cookie: A.cookie })).json.data as Rig[])[0] as Rig
    const spareB = (await call(inventoryRoute, { cookie: B.cookie })).json.data.find((i: { rigId: string | null }) => i.rigId === null) as { id: string } | undefined
    const itemA = rigA.components[0]?.itemId as string
    expect((await call(rigRoute, { cookie: B.cookie, params: { id: rigA.id } })).status).toBe(404)
    expect((await call(renameRigRoute, { cookie: B.cookie, method: 'PATCH', params: { id: rigA.id }, body: { name: 'hijacked' } })).status).toBe(404)
    expect((await call(deleteRigRoute, { cookie: B.cookie, method: 'DELETE', params: { id: rigA.id } })).status).toBe(404)
    expect((await call(removeRoute, { cookie: B.cookie, method: 'DELETE', params: { id: rigA.id, itemId: itemA } })).status).toBe(404)
    if (spareB) expect((await call(assignRoute, { cookie: B.cookie, params: { id: rigA.id }, body: { inventoryItemId: spareB.id } })).status).toBe(404)
    const after = (await call(rigRoute, { cookie: A.cookie, params: { id: rigA.id } })).json.data as Rig
    expect(after.name).toBe(rigA.name)
    expect(after.components).toHaveLength(rigA.components.length)
  })

  it("B cannot install A's inventory item into B's own rig", async () => {
    const itemA = (await call(inventoryRoute, { cookie: A.cookie })).json.data.find((i: { rigId: string | null }) => i.rigId === null) as { id: string }
    const rigB = await call(createRigRoute, { cookie: B.cookie, body: { name: 'B2' } })
    const res = await call(assignRoute, { cookie: B.cookie, params: { id: rigB.json.data.id }, body: { inventoryItemId: itemA.id } })
    expect(res.status).toBe(404)
    expect(await prisma.rigComponent.count({ where: { inventoryItemId: itemA.id } })).toBe(0)
  })

  it('players can use the same rig name independently', async () => {
    const a = await call(createRigRoute, { cookie: A.cookie, body: { name: 'Shared Name' } })
    const b = await call(createRigRoute, { cookie: B.cookie, body: { name: 'Shared Name' } })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(a.json.data.id).not.toBe(b.json.data.id)
  })
})

describe('jobs, rewards, challenges and progression stay private', () => {
  let jobA: string
  let challengeA: string
  const DAY = 24 * 60 * 60 * 1000

  it('A runs a job; B sees nothing and cannot touch it', async () => {
    const gen = await call(generateRoute, { cookie: A.cookie, body: { definitionId: await definitionId('route-basic') } })
    expect(gen.status).toBe(201)
    challengeA = gen.json.data.id
    const solution = solveOptimally(gen.json.data.payload)
    const rigA = ((await call(rigsRoute, { cookie: A.cookie })).json.data as Rig[])[0] as Rig
    const start = await call(startJobRoute, { cookie: A.cookie, body: { rigId: rigA.id, challengeInstanceId: challengeA, solution } })
    expect(start.status).toBe(201)
    jobA = start.json.data.id

    expect((await call(jobsRoute, { cookie: B.cookie })).json.data).toEqual([])
    expect((await call(jobRoute, { cookie: B.cookie, params: { id: jobA } })).status).toBe(404)
    expect((await call(claimRoute, { cookie: B.cookie, params: { id: jobA }, body: {} })).status).toBe(404)
    expect((await call(cancelRoute, { cookie: B.cookie, params: { id: jobA }, body: {} })).status).toBe(404)
    const dashB = await call(dashboardRoute, { cookie: B.cookie })
    expect(dashB.json.data.activeJobs).toEqual([])
    expect((await call(jobRoute, { cookie: A.cookie, params: { id: jobA } })).status).toBe(200)
  })

  it("B cannot see, check or use A's challenges", async () => {
    const listB = await call(challengesRoute, { cookie: B.cookie })
    expect(listB.json.data.open.some((c: { id: string }) => c.id === challengeA)).toBe(false)
    const solution = { type: 'PATH', path: [0, 1] }
    expect((await call(checkRoute, { cookie: B.cookie, params: { id: challengeA }, body: { solution } })).status).toBe(404)
    const rigB = ((await call(rigsRoute, { cookie: B.cookie })).json.data as Rig[])[0] as Rig
    const hijack = await call(startJobRoute, { cookie: B.cookie, body: { rigId: rigB.id, challengeInstanceId: challengeA, solution } })
    expect(hijack.status).toBe(404)
  })

  it("B cannot run A's rig with B's own challenge", async () => {
    const gen = await call(generateRoute, { cookie: B.cookie, body: { definitionId: await definitionId('route-basic') } })
    const solution = solveOptimally(gen.json.data.payload)
    const rigA = ((await call(rigsRoute, { cookie: A.cookie })).json.data as Rig[])[0] as Rig
    const res = await call(startJobRoute, { cookie: B.cookie, body: { rigId: rigA.id, challengeInstanceId: gen.json.data.id, solution } })
    expect(res.status).toBe(404)
    expect((await prisma.challengeInstance.findUniqueOrThrow({ where: { id: gen.json.data.id } })).status).toBe('OPEN')
  })

  it("A's reward is credited to A once, and B's balances never move", async () => {
    const beforeB = await call(dashboardRoute, { cookie: B.cookie })
    const later = new Date(Date.now() + 5 * 60 * 1000)
    const claim = await claimJob(A.playerId, jobA, later)
    expect(claim.rewardMq).toBeGreaterThan(0)
    await expect(claimJob(A.playerId, jobA, later)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(claimJob(B.playerId, jobA, later)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const afterB = await call(dashboardRoute, { cookie: B.cookie })
    expect(afterB.json.data.balances).toEqual(beforeB.json.data.balances)
    expect(afterB.json.data.progress.xp).toBe(beforeB.json.data.progress.xp)
    const playerA = await prisma.player.findUniqueOrThrow({ where: { id: A.playerId } })
    expect(playerA.quantaMilli).toBe(claim.rewardMq)
    await Promise.all([expectReconciled(A.playerId), expectReconciled(B.playerId)])
    void DAY
  })

  it('XP, level, achievements and ledger persist across logout and a fresh login on another device', async () => {
    const before = await call(dashboardRoute, { cookie: A.cookie })
    const progressBefore = await call(progressionRoute, { cookie: A.cookie })
    const unlockedBefore = progressBefore.json.data.achievements.filter((x: { unlockedAt: string | null }) => x.unlockedAt).map((x: { slug: string }) => x.slug)
    expect(unlockedBefore).toEqual(expect.arrayContaining(['first-job', 'first-claim']))
    expect(before.json.data.progress.xp).toBeGreaterThan(0)

    await call((await import('@/app/api/auth/logout/route')).POST, { cookie: A.cookie, body: { everywhere: true } })
    expect((await call(dashboardRoute, { cookie: A.cookie })).status).toBe(401)

    const login = await call(loginRoute, { body: { identifier: A.email, password: A.password } })
    const fresh = asCookie(login.sessionCookie)
    const after = await call(dashboardRoute, { cookie: fresh })
    expect(after.json.data.balances).toEqual(before.json.data.balances)
    expect(after.json.data.progress).toEqual(before.json.data.progress)
    expect(after.json.data.totals.achievementsUnlocked).toBe(before.json.data.totals.achievementsUnlocked)
    const progressAfter = await call(progressionRoute, { cookie: fresh })
    expect(progressAfter.json.data.achievements.filter((x: { unlockedAt: string | null }) => x.unlockedAt).map((x: { slug: string }) => x.slug)).toEqual(unlockedBefore)
    const ledgerAfter = await call(ledgerRoute, { cookie: fresh })
    expect(ledgerAfter.json.data.entries.length).toBeGreaterThan(5)
    expect(ledgerAfter.json.data.reconciliation.every((r: { reconciled: boolean }) => r.reconciled)).toBe(true)
    A.cookie = fresh as string
  })

  it("market data is shared catalog only: it never exposes another player's holdings", async () => {
    const market = await call(marketRoute, { cookie: B.cookie })
    const item = market.json.data.items.find((i: { slug: string }) => i.slug === 'cpu-pulse')
    // B owns exactly the starter CPU; A owns more, and that must not show up.
    expect(item.owned).toBe(1)
  })
})
