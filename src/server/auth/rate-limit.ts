import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { DomainError } from '../errors'

/**
 * Fixed-window rate limiter stored in PostgreSQL, so limits hold across
 * serverless instances. One atomic upsert per attempt.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const rows = await prisma.$queryRaw<Array<{ count: number; elapsed: number }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" < now() - make_interval(secs => ${windowSec}::double precision)
                     THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" < now() - make_interval(secs => ${windowSec}::double precision)
                           THEN now() ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count", EXTRACT(EPOCH FROM (now() - "windowStart"))::float8 AS "elapsed"
  `)
  const row = rows[0]
  const count = Number(row?.count ?? 1)
  const elapsed = Number(row?.elapsed ?? 0)
  return { allowed: count <= limit, retryAfterSec: Math.max(1, Math.ceil(windowSec - elapsed)) }
}

/** True once `limit` attempts were already recorded in the current window (does not count an attempt). */
export async function isBlocked(key: string, limit: number, windowSec: number): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } })
  if (!bucket) return { blocked: false, retryAfterSec: 0 }
  const elapsed = (Date.now() - bucket.windowStart.getTime()) / 1000
  if (elapsed >= windowSec) return { blocked: false, retryAfterSec: 0 }
  return { blocked: bucket.count >= limit, retryAfterSec: Math.max(1, Math.ceil(windowSec - elapsed)) }
}

/** Count an attempt and throw 429 when the limit is exceeded. */
export async function enforce(key: string, limit: number, windowSec: number, message = 'Too many attempts. Please wait and try again.'): Promise<void> {
  const result = await hit(key, limit, windowSec)
  if (!result.allowed) throw new DomainError('RATE_LIMITED', message, { retryAfterSec: result.retryAfterSec })
}

export async function clear(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } })
}

/**
 * Best-effort client address. On Vercel the platform sets these headers itself.
 * Behind other proxies, make sure your proxy overwrites them, otherwise the
 * per-address limit can be dodged (the per-account limits still apply).
 */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim().slice(0, 64)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return (forwarded.split(',')[0] ?? '').trim().slice(0, 64) || 'unknown'
  return 'unknown'
}
