import { beforeEach, describe, expect, it } from 'vitest'
import { POST as registerRoute } from '@/app/api/auth/register/route'
import { POST as loginRoute } from '@/app/api/auth/login/route'
import { POST as logoutRoute } from '@/app/api/auth/logout/route'
import { POST as forgotRoute } from '@/app/api/auth/forgot/route'
import { POST as resetRoute } from '@/app/api/auth/reset/route'
import { GET as meRoute } from '@/app/api/auth/me/route'
import { GET as dashboardRoute } from '@/app/api/dashboard/route'
import { GET as accountRoute, PATCH as accountPatch } from '@/app/api/account/route'
import { POST as changePasswordRoute } from '@/app/api/account/password/route'
import { POST as purchaseRoute } from '@/app/api/marketplace/purchase/route'
import { GET as cronRoute } from '@/app/api/cron/settle/route'
import { prisma } from '@/server/db'
import { sentMail } from '@/server/mailer'
import { SESSION_RULES } from '@/server/auth/session'
import { hashToken } from '@/server/auth/tokens'
import { STARTING_RESOURCES } from '@/lib/game/config'
import { asCookie, call } from './http'
import { equipmentId, registerAccount, TEST_PASSWORD } from './helpers'

const uniq = () => Math.random().toString(36).slice(2, 10)
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  sentMail.length = 0
})

describe('registration', () => {
  it('creates the user, player, starting resources, Starter Rig and ledger in one go', async () => {
    const a = await registerAccount()
    const user = await prisma.user.findUniqueOrThrow({ where: { email: a.email }, include: { player: { include: { rigs: { include: { components: true } }, ledger: true } } } })
    expect(user.player).toMatchObject({ credits: STARTING_RESOURCES.credits, energy: STARTING_RESOURCES.energy, quantaMilli: 0, xp: 0, level: 1, displayName: a.username })
    expect(user.player?.rigs).toHaveLength(1)
    expect(user.player?.rigs[0]?.components).toHaveLength(5)
    expect(user.player?.ledger.map((l) => l.type)).toEqual(['GRANT', 'GRANT'])
    // The new player lands on a working dashboard.
    const dash = await call(dashboardRoute, { cookie: a.cookie })
    expect(dash.status).toBe(200)
    expect(dash.json.data.player.username).toBe(a.username)
    expect(dash.json.data.balances).toMatchObject({ credits: 1500, energy: 400, quantaMilli: 0 })
  })

  it('stores an Argon2id hash, never the password, and returns no secrets', async () => {
    const a = await registerAccount()
    const user = await prisma.user.findUniqueOrThrow({ where: { email: a.email } })
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(user.passwordHash).not.toContain(a.password)
    const res = await call(registerRoute, { body: { username: `x_${uniq()}`, email: `${uniq()}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD } })
    expect(JSON.stringify(res.json)).not.toMatch(/argon2|passwordHash/i)
  })

  it('sets a secure session cookie (HttpOnly, SameSite=Lax) and stores only its hash', async () => {
    const res = await call(registerRoute, { body: { username: `c_${uniq()}`, email: `${uniq()}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD } })
    const header = res.headers.get('set-cookie') ?? ''
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/SameSite=lax/i)
    expect(header).toMatch(/Path=\//i)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const stored = await prisma.session.findUnique({ where: { tokenHash: hashToken(res.sessionCookie as string) } })
    expect(stored).not.toBeNull()
    expect(await prisma.session.findFirst({ where: { tokenHash: res.sessionCookie as string } })).toBeNull()
  })

  it('rejects duplicate usernames and emails (case-insensitive)', async () => {
    const a = await registerAccount()
    const sameName = await call(registerRoute, { body: { username: a.username.toUpperCase(), email: `${uniq()}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD } })
    expect(sameName.status).toBe(409)
    expect(sameName.json.error?.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'username' })]))
    const sameEmail = await call(registerRoute, { body: { username: `d_${uniq()}`, email: a.email.toUpperCase(), password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD } })
    expect(sameEmail.status).toBe(409)
    expect(sameEmail.json.error?.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'email' })]))
    expect(await prisma.user.count({ where: { OR: [{ email: a.email }, { usernameLower: a.username.toLowerCase() }] } })).toBe(1)
  })

  it('creates exactly one account when identical sign-ups race, with no orphaned player', async () => {
    const username = `r_${uniq()}`
    const email = `${username}@example.com`
    const body = { username, email, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD }
    const results = await Promise.all(Array.from({ length: 4 }, () => call(registerRoute, { body })))
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(3)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    expect(await prisma.player.count({ where: { handle: username.toLowerCase() } })).toBe(1)
  })

  it.each([
    ['short password', { password: 'abc123', confirmPassword: 'abc123' }, 'password'],
    ['password without a number', { password: 'onlyletterspassword', confirmPassword: 'onlyletterspassword' }, 'password'],
    ['mismatched confirmation', { confirmPassword: 'different-password-1' }, 'confirmPassword'],
    ['invalid email', { email: 'not-an-email' }, 'email'],
    ['invalid username', { username: 'no spaces!' }, 'username'],
    ['reserved username', { username: 'admin' }, 'username'],
    ['password containing the username', { username: 'wanderer', password: 'wanderer-1234567', confirmPassword: 'wanderer-1234567' }, 'password'],
  ])('validates server-side: %s', async (_name, override, field) => {
    const res = await call(registerRoute, { body: { username: `v_${uniq()}`, email: `${uniq()}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD, ...override } })
    expect(res.status).toBe(400)
    expect(res.json.error?.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: field })]))
  })

  it('ignores unexpected fields (no mass assignment of balances or ids)', async () => {
    const username = `m_${uniq()}`
    const res = await call(registerRoute, {
      body: { username, email: `${username}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD, credits: 999999, id: 'forced-id', playerId: 'x', level: 20 },
    })
    expect(res.status).toBe(201)
    const player = await prisma.player.findUniqueOrThrow({ where: { handle: username.toLowerCase() } })
    expect(player).toMatchObject({ credits: 1500, level: 1 })
    expect(player.id).not.toBe('forced-id')
  })

  it('rate-limits sign-ups from one address', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}-${uniq()}`
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const name = `rl_${uniq()}`
      const res = await call(registerRoute, { ip, body: { username: name, email: `${name}@example.com`, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD } })
      statuses.push(res.status)
    }
    expect(statuses.filter((s) => s === 201)).toHaveLength(10)
    expect(statuses.slice(10)).toEqual([429, 429])
  })
})

describe('login and logout', () => {
  it('logs in with the email or the username (any letter case) and works on a second device', async () => {
    const a = await registerAccount()
    const byEmail = await call(loginRoute, { body: { identifier: a.email.toUpperCase(), password: a.password } })
    const byName = await call(loginRoute, { body: { identifier: a.username.toUpperCase(), password: a.password } })
    expect(byEmail.status).toBe(200)
    expect(byName.status).toBe(200)
    expect(byEmail.sessionCookie).not.toBe(byName.sessionCookie)
    const me1 = await call(meRoute, { cookie: asCookie(byEmail.sessionCookie) })
    const me2 = await call(meRoute, { cookie: asCookie(byName.sessionCookie) })
    expect(me1.json.data.username).toBe(a.username)
    expect(me2.json.data.username).toBe(a.username)
  })

  it('rejects a wrong password and an unknown account with the same generic answer', async () => {
    const a = await registerAccount()
    const wrong = await call(loginRoute, { body: { identifier: a.email, password: 'wrong-password-1' } })
    const unknown = await call(loginRoute, { body: { identifier: `nobody_${uniq()}@example.com`, password: 'wrong-password-1' } })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json.error?.message).toBe(unknown.json.error?.message)
    expect(wrong.sessionCookie).toBeNull()
  })

  it('locks an account after repeated failures, then recovers with a clean window', async () => {
    const a = await registerAccount()
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}-${uniq()}`
    for (let i = 0; i < 8; i++) expect((await call(loginRoute, { ip: `${ip}-${i}`, body: { identifier: a.email, password: 'nope-nope-nope1' } })).status).toBe(401)
    const blocked = await call(loginRoute, { body: { identifier: a.email, password: a.password } })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
    await prisma.rateLimitBucket.deleteMany({ where: { key: `login:id:${a.email}` } })
    expect((await call(loginRoute, { body: { identifier: a.email, password: a.password } })).status).toBe(200)
  })

  it('rate-limits login attempts per address', async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 200)}-${uniq()}`
    const codes: number[] = []
    for (let i = 0; i < 32; i++) codes.push((await call(loginRoute, { ip, body: { identifier: `ghost${i}@example.com`, password: 'wrong-password-1' } })).status)
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(2)
  })

  it('logout ends the session on the server, not just in the browser', async () => {
    const a = await registerAccount()
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(200)
    const out = await call(logoutRoute, { cookie: a.cookie, body: {} })
    expect(out.status).toBe(200)
    expect(out.sessionCookie).toBe('')
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(401)
    // Logging out again with a dead cookie is harmless.
    expect((await call(logoutRoute, { cookie: a.cookie, body: {} })).status).toBe(200)
  })

  it('"log out everywhere" ends every device but a plain logout keeps the others', async () => {
    const a = await registerAccount()
    const second = await call(loginRoute, { body: { identifier: a.email, password: a.password } })
    const third = await call(loginRoute, { body: { identifier: a.email, password: a.password } })
    await call(logoutRoute, { cookie: asCookie(second.sessionCookie), body: {} })
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(200)
    await call(logoutRoute, { cookie: asCookie(third.sessionCookie), body: { everywhere: true } })
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(401)
  })
})

describe('unauthorised access', () => {
  it('rejects every protected endpoint without a valid session', async () => {
    const { GET: market } = await import('@/app/api/marketplace/route')
    const { GET: rigs } = await import('@/app/api/rigs/route')
    const { GET: jobs } = await import('@/app/api/jobs/route')
    const { GET: ledger } = await import('@/app/api/ledger/route')
    for (const handler of [dashboardRoute, market, rigs, jobs, ledger, accountRoute, meRoute]) {
      expect((await call(handler)).status).toBe(401)
      expect((await call(handler, { cookie: 'dive_session=not-a-real-token' })).status).toBe(401)
    }
    const buy = await call(purchaseRoute, { body: { equipmentId: await equipmentId('ram-8') } })
    expect(buy.status).toBe(401)
  })

  it('rejects expired sessions and removes them', async () => {
    const a = await registerAccount()
    await prisma.session.updateMany({ where: { tokenHash: hashToken(a.cookie.split('=')[1] as string) }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const res = await call(dashboardRoute, { cookie: a.cookie })
    expect(res.status).toBe(401)
    expect(res.sessionCookie).toBe('') // the stale cookie is cleared
    expect(await prisma.session.count({ where: { tokenHash: hashToken(a.cookie.split('=')[1] as string) } })).toBe(0)
  })

  it('renews a session that is past half-way, but never beyond the absolute maximum', async () => {
    const a = await registerAccount()
    const hash = hashToken(a.cookie.split('=')[1] as string)
    await prisma.session.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(Date.now() + 5 * DAY) } })
    const res = await call(dashboardRoute, { cookie: a.cookie })
    expect(res.status).toBe(200)
    expect(res.sessionCookie).toBe(a.cookie.split('=')[1])
    const renewed = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hash } })
    expect(renewed.expiresAt.getTime() - Date.now()).toBeGreaterThan(25 * DAY)

    // A session created 89 days ago may only be extended up to day 90.
    await prisma.session.update({ where: { tokenHash: hash }, data: { createdAt: new Date(Date.now() - 89 * DAY), expiresAt: new Date(Date.now() + 0.5 * DAY) } })
    await call(dashboardRoute, { cookie: a.cookie })
    const capped = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hash } })
    expect(capped.expiresAt.getTime() - capped.createdAt.getTime()).toBeLessThanOrEqual(SESSION_RULES.absoluteMaxDays * DAY + 1000)
  })

  it('blocks cross-site state-changing requests (CSRF)', async () => {
    const a = await registerAccount()
    const eq = await equipmentId('ram-8')
    const evilFetch = await call(purchaseRoute, { cookie: a.cookie, body: { equipmentId: eq }, headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' } })
    expect(evilFetch.status).toBe(403)
    const evilOrigin = await call(purchaseRoute, { cookie: a.cookie, body: { equipmentId: eq }, headers: { origin: 'https://evil.example' } })
    expect(evilOrigin.status).toBe(403)
    const sameSite = await call(purchaseRoute, { cookie: a.cookie, body: { equipmentId: eq }, headers: { 'sec-fetch-site': 'same-origin' } })
    expect(sameSite.status).toBe(201)
    // Sign-in is protected the same way.
    expect((await call(loginRoute, { body: { identifier: a.email, password: a.password }, headers: { origin: 'https://evil.example' } })).status).toBe(403)
  })
})

describe('password recovery', () => {
  const tokenFrom = (text: string) => /#token=([A-Za-z0-9_-]+)/.exec(text)?.[1] as string

  it('answers identically for unknown emails and sends nothing', async () => {
    const known = await registerAccount()
    const a = await call(forgotRoute, { body: { email: known.email } })
    const b = await call(forgotRoute, { body: { email: `ghost_${uniq()}@example.com` } })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.json.data).toEqual(b.json.data)
    expect(sentMail).toHaveLength(1)
    expect(sentMail[0]?.to).toBe(known.email)
  })

  it('emails a one-time link (token in the URL fragment), stores only its hash, and expires it', async () => {
    const a = await registerAccount()
    await call(forgotRoute, { body: { email: a.email } })
    const mail = sentMail[0]
    expect(mail?.text).toContain('https://dive.test/reset-password#token=')
    const token = tokenFrom(mail?.text ?? '')
    const rows = await prisma.passwordResetToken.findMany({ where: { user: { email: a.email } } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).toBe(hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
    const lifetime = (rows[0]?.expiresAt.getTime() ?? 0) - Date.now()
    expect(lifetime).toBeLessThanOrEqual(30 * 60 * 1000)
    expect(lifetime).toBeGreaterThan(25 * 60 * 1000)
  })

  it('resets the password once, signs out every device, and the old password stops working', async () => {
    const a = await registerAccount()
    await call(forgotRoute, { body: { email: a.email } })
    const token = tokenFrom(sentMail[0]?.text ?? '')
    const newPassword = 'a-brand-new-passphrase-7'
    const done = await call(resetRoute, { body: { token, password: newPassword } })
    expect(done.status).toBe(200)
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(401)
    expect((await call(loginRoute, { body: { identifier: a.email, password: a.password } })).status).toBe(401)
    expect((await call(loginRoute, { body: { identifier: a.email, password: newPassword } })).status).toBe(200)
    // Single use.
    expect((await call(resetRoute, { body: { token, password: 'yet-another-passphrase-8' } })).status).toBe(400)
  })

  it('rejects expired, invalid, and weak-password reset attempts', async () => {
    const a = await registerAccount()
    await call(forgotRoute, { body: { email: a.email } })
    const token = tokenFrom(sentMail[0]?.text ?? '')
    expect((await call(resetRoute, { body: { token: 'x'.repeat(43), password: 'a-brand-new-passphrase-7' } })).status).toBe(400)
    expect((await call(resetRoute, { body: { token, password: 'short1' } })).status).toBe(400)
    await prisma.passwordResetToken.updateMany({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await call(resetRoute, { body: { token, password: 'a-brand-new-passphrase-7' } })).status).toBe(400)
    expect((await call(loginRoute, { body: { identifier: a.email, password: a.password } })).status).toBe(200)
  })

  it('a newer request invalidates the previous link', async () => {
    const a = await registerAccount()
    await call(forgotRoute, { body: { email: a.email } })
    await call(forgotRoute, { body: { email: a.email } })
    const [first, second] = sentMail.map((m) => tokenFrom(m.text))
    expect((await call(resetRoute, { body: { token: first, password: 'a-brand-new-passphrase-7' } })).status).toBe(400)
    expect((await call(resetRoute, { body: { token: second, password: 'a-brand-new-passphrase-7' } })).status).toBe(200)
  })

  it('never writes reset tokens to the application logs', async () => {
    const lines: string[] = []
    const spies = (['log', 'info', 'warn', 'error'] as const).map((level) => {
      const original = console[level]
      console[level] = (...args: unknown[]) => void lines.push(args.map(String).join(' '))
      return () => void (console[level] = original)
    })
    try {
      const a = await registerAccount()
      await call(forgotRoute, { body: { email: a.email } })
      const token = tokenFrom(sentMail[0]?.text ?? '')
      await call(resetRoute, { body: { token, password: 'a-brand-new-passphrase-7' } })
      expect(lines.join('\n')).not.toContain(token)
    } finally {
      spies.forEach((restore) => restore())
    }
  })
})

describe('account settings', () => {
  it('changes the password: needs the current one, keeps this device, signs out the others', async () => {
    const a = await registerAccount()
    const other = await call(loginRoute, { body: { identifier: a.email, password: a.password } })
    const wrong = await call(changePasswordRoute, { cookie: a.cookie, body: { currentPassword: 'not-my-password-1', newPassword: 'a-brand-new-passphrase-7' } })
    expect(wrong.status).toBe(400)
    const ok = await call(changePasswordRoute, { cookie: a.cookie, body: { currentPassword: a.password, newPassword: 'a-brand-new-passphrase-7' } })
    expect(ok.status).toBe(200)
    expect((await call(meRoute, { cookie: a.cookie })).status).toBe(200)
    expect((await call(meRoute, { cookie: asCookie(other.sessionCookie) })).status).toBe(401)
    expect((await call(loginRoute, { body: { identifier: a.email, password: 'a-brand-new-passphrase-7' } })).status).toBe(200)
  })

  it('changes the username without touching progress, and still blocks duplicates', async () => {
    const a = await registerAccount()
    const b = await registerAccount()
    const newName = `renamed_${uniq()}`
    const ok = await call(accountPatch, { cookie: a.cookie, method: 'PATCH', body: { username: newName } })
    expect(ok.status).toBe(200)
    expect(ok.json.data.username).toBe(newName)
    const dash = await call(dashboardRoute, { cookie: a.cookie })
    expect(dash.json.data.player.username).toBe(newName)
    expect(dash.json.data.balances.credits).toBe(1500)
    const dup = await call(accountPatch, { cookie: a.cookie, method: 'PATCH', body: { username: b.username.toUpperCase() } })
    expect(dup.status).toBe(409)
    expect((await call(loginRoute, { body: { identifier: newName, password: a.password } })).status).toBe(200)
  })

  it('account info never includes the password hash', async () => {
    const a = await registerAccount()
    const res = await call(accountRoute, { cookie: a.cookie })
    expect(res.json.data).toMatchObject({ username: a.username, email: a.email })
    expect(JSON.stringify(res.json)).not.toMatch(/argon2|passwordHash/i)
  })
})

describe('scheduled settlement', () => {
  it('requires the cron secret', async () => {
    const noAuth = await cronRoute(new Request('http://localhost/api/cron/settle'))
    const wrong = await cronRoute(new Request('http://localhost/api/cron/settle', { headers: { authorization: 'Bearer nope' } }))
    const ok = await cronRoute(new Request('http://localhost/api/cron/settle', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))
    expect(noAuth.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(ok.status).toBe(200)
  })
})
