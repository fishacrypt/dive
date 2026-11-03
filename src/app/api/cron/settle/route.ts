import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'

export const dynamic = 'force-dynamic'

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Scheduled housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 *  - settles every mining job whose end time has passed, for all players
 *  - removes expired sessions, old reset tokens and stale rate-limit counters
 * Rewards are NOT claimed here: players claim their own rewards.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Unauthorised.' } }, { status: 401 })
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [jobs, sessions, tokens, buckets] = await Promise.all([
    prisma.miningJob.updateMany({ where: { status: 'RUNNING', endsAt: { lte: now } }, data: { status: 'COMPLETED', settledAt: now } }),
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lte: dayAgo } }, { usedAt: { lte: dayAgo } }] } }),
    prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lte: dayAgo } } }),
  ])
  return NextResponse.json({ ok: true, data: { jobsSettled: jobs.count, sessionsRemoved: sessions.count, tokensRemoved: tokens.count, bucketsRemoved: buckets.count } })
}
