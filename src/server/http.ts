import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError, type ZodType } from 'zod'
import { DomainError, STATUS_BY_CODE } from './errors'
import { authenticate, sessionCookieOptions, SESSION_COOKIE, type AuthContext } from './auth/session'
import { clientIp } from './auth/rate-limit'

/** Every API response uses this envelope: { ok: true, data } or { ok: false, error }. */
export interface ApiSuccess<T> {
  ok: true
  data: T
}
export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

type CookieOp = { name: string; value: string; options: ReturnType<typeof sessionCookieOptions> }

/** Collects cookie changes made by a handler; applied to the response by the wrapper. */
export class CookieJar {
  readonly ops: CookieOp[] = []
  setSession(token: string, expires: Date): void {
    this.ops.push({ name: SESSION_COOKIE, value: token, options: sessionCookieOptions(expires) })
  }
  clearSession(): void {
    this.ops.push({ name: SESSION_COOKIE, value: '', options: sessionCookieOptions(new Date(0)) })
  }
}

function finish<T extends object>(response: NextResponse<T>, jar: CookieJar): NextResponse<T> {
  for (const op of jar.ops) response.cookies.set(op.name, op.value, op.options)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function success<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, { status })
}

export function failure(code: string, message: string, status: number, details?: unknown): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false as const, error: { code, message, details } }, { status })
}

/** Centralised error handling: domain errors, validation errors, DB errors, everything else. */
export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof DomainError) {
    const res = failure(error.code, error.message, STATUS_BY_CODE[error.code], error.details)
    if (error.code === 'RATE_LIMITED') {
      const retry = (error.details as { retryAfterSec?: number } | undefined)?.retryAfterSec
      if (retry) res.headers.set('Retry-After', String(retry))
    }
    return res
  }
  if (error instanceof ZodError) {
    return failure('VALIDATION', 'Please check the highlighted fields.', 400, error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return failure('CONFLICT', 'That action was already recorded.', 409)
  }
  // Never log request bodies, cookies or tokens here: only the error itself.
  console.error('Unhandled API error', error)
  return failure('INTERNAL', 'Something went wrong on the server.', 500)
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie-authenticated requests, on top of SameSite=Lax:
 * state-changing requests must come from this site. Browsers send
 * Sec-Fetch-Site (which scripts cannot forge); Origin is the fallback.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) {
    if (fetchSite === 'same-origin' || fetchSite === 'none') return
    throw new DomainError('FORBIDDEN', 'Cross-site requests are not allowed.')
  }
  const origin = request.headers.get('origin')
  if (!origin) return // not a browser (no cookie-borne CSRF possible), e.g. curl or server-to-server
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw new DomainError('FORBIDDEN', 'Cross-site requests are not allowed.')
  }
  const allowed = new Set<string>()
  for (const h of [request.headers.get('host'), request.headers.get('x-forwarded-host'), new URL(request.url).host]) {
    if (h) allowed.add(h)
  }
  for (const o of (process.env.ALLOWED_ORIGINS ?? '').split(',')) {
    try {
      if (o.trim()) allowed.add(new URL(o.trim()).host)
    } catch {
      // ignore malformed entries
    }
  }
  if (!allowed.has(originHost)) throw new DomainError('FORBIDDEN', 'Cross-site requests are not allowed.')
}

export interface RouteContext<P = Record<string, string>> {
  /** From the verified server-side session. Never from the request body, query or headers. */
  playerId: string
  userId: string
  username: string
  sessionId: string
  params: P
  request: Request
  cookies: CookieJar
}

export interface PublicContext<P = Record<string, string>> {
  params: P
  request: Request
  cookies: CookieJar
  ip: string
  userAgent: string | null
}

type Segment<P> = { params: Promise<P> | P }

/**
 * Wrap a PROTECTED route handler. The player always comes from the verified
 * session cookie: unauthenticated requests get 401 before any handler code runs.
 */
export function route<T, P = Record<string, string>>(handler: (ctx: RouteContext<P>) => Promise<T>, successStatus = 200) {
  return async (request: Request, segment: Segment<P>): Promise<NextResponse<ApiSuccess<T> | ApiFailure>> => {
    const jar = new CookieJar()
    try {
      assertSameOrigin(request)
      const auth: AuthContext = await authenticate(request)
      const params = await segment.params
      const data = await handler({ playerId: auth.playerId, userId: auth.userId, username: auth.username, sessionId: auth.sessionId, params, request, cookies: jar })
      if (auth.renewedUntil) jar.setSession(auth.token, auth.renewedUntil)
      return finish(success(data, successStatus), jar)
    } catch (error) {
      const res = toErrorResponse(error)
      // A rejected session also clears the stale cookie.
      if (error instanceof DomainError && error.code === 'UNAUTHENTICATED') jar.clearSession()
      return finish(res, jar)
    }
  }
}

/** Wrap a PUBLIC route (login, register, password recovery). Same CSRF and error handling, no session required. */
export function publicRoute<T, P = Record<string, string>>(handler: (ctx: PublicContext<P>) => Promise<T>, successStatus = 200) {
  return async (request: Request, segment: Segment<P>): Promise<NextResponse<ApiSuccess<T> | ApiFailure>> => {
    const jar = new CookieJar()
    try {
      assertSameOrigin(request)
      const params = await segment.params
      const data = await handler({ params, request, cookies: jar, ip: clientIp(request), userAgent: request.headers.get('user-agent') })
      return finish(success(data, successStatus), jar)
    } catch (error) {
      return finish(toErrorResponse(error), jar)
    }
  }
}

/** Parse and validate a JSON body. Empty bodies are treated as {}. Unknown fields are stripped by the schema. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = await request.text()
  if (text.length > 20_000) throw new DomainError('VALIDATION', 'Request body is too large.')
  let raw: unknown = {}
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text)
    } catch {
      throw new DomainError('VALIDATION', 'Request body must be valid JSON.')
    }
  }
  return schema.parse(raw)
}

/** Optional Idempotency-Key header (also accepted in the body by individual routes). */
export function idempotencyKeyFrom(request: Request, bodyKey?: string): string | undefined {
  const header = request.headers.get('idempotency-key')
  return bodyKey ?? header ?? undefined
}
