import { prisma } from '../db'
import { DomainError } from '../errors'
import { generateToken, hashToken } from './tokens'

const DAY_MS = 24 * 60 * 60 * 1000

export const SESSION_RULES = {
  /** A session lasts this long after its last renewal... */
  ttlDays: 30,
  /** ...is renewed when less than half is left... */
  renewBelowDays: 15,
  /** ...but can never live longer than this in total, so users sign in again eventually. */
  absoluteMaxDays: 90,
} as const

const SECURE = process.env.NODE_ENV === 'production'
/** The __Host- prefix makes browsers reject the cookie unless it is Secure, path=/ and domain-less. */
export const SESSION_COOKIE = SECURE ? '__Host-dive_session' : 'dive_session'

export interface CookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  expires: Date
}

export function sessionCookieOptions(expires: Date): CookieOptions {
  return { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', expires }
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

export async function createSession(userId: string, userAgent: string | null, now = new Date()) {
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + SESSION_RULES.ttlDays * DAY_MS)
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, lastUsedAt: now, userAgent: userAgent?.slice(0, 200) ?? null },
  })
  return { token, expiresAt }
}

export interface AuthContext {
  userId: string
  playerId: string
  username: string
  sessionId: string
  /** Set when the session was extended, so the cookie can be refreshed too. */
  renewedUntil: Date | null
  token: string
}

/** Resolve a session token to the verified user and their one player. Returns null if invalid or expired. */
export async function resolveSession(token: string | null, now = new Date()): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { player: { select: { id: true } } } } },
  })
  if (!session) return null
  if (session.expiresAt <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } })
    return null
  }
  const player = session.user.player
  if (!player) return null

  let renewedUntil: Date | null = null
  const remaining = session.expiresAt.getTime() - now.getTime()
  if (remaining < SESSION_RULES.renewBelowDays * DAY_MS) {
    const cap = session.createdAt.getTime() + SESSION_RULES.absoluteMaxDays * DAY_MS
    const next = new Date(Math.min(now.getTime() + SESSION_RULES.ttlDays * DAY_MS, cap))
    if (next > session.expiresAt) {
      await prisma.session.update({ where: { id: session.id }, data: { expiresAt: next, lastUsedAt: now } })
      renewedUntil = next
    }
  }
  return { userId: session.userId, playerId: player.id, username: session.user.username, sessionId: session.id, renewedUntil, token }
}

/** Authenticate an API request from its Cookie header. Throws 401 if there is no valid session. */
export async function authenticate(request: Request): Promise<AuthContext> {
  const ctx = await resolveSession(readCookie(request.headers.get('cookie'), SESSION_COOKIE))
  if (!ctx) throw new DomainError('UNAUTHENTICATED', 'Please log in to continue.')
  return ctx
}
