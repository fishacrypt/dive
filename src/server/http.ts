import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError, type ZodType } from 'zod'
import { DomainError, STATUS_BY_CODE } from './errors'
import { getPlayerId } from './session'

/** Every API response uses this envelope: { ok: true, data } or { ok: false, error }. */
export interface ApiSuccess<T> {
  ok: true
  data: T
}
export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
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
    return failure(error.code, error.message, STATUS_BY_CODE[error.code], error.details)
  }
  if (error instanceof ZodError) {
    return failure('VALIDATION', 'Invalid request.', 400, error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return failure('CONFLICT', 'That action was already recorded.', 409)
  }
  console.error('Unhandled API error', error)
  return failure('INTERNAL', 'Something went wrong on the server.', 500)
}

export interface RouteContext<P = Record<string, string>> {
  playerId: string
  params: P
  request: Request
}

type Handler<T, P> = (ctx: RouteContext<P>) => Promise<T>

/** Wrap a route handler: resolves the player, runs it, wraps the result, handles errors. */
export function route<T, P = Record<string, string>>(handler: Handler<T, P>, successStatus = 200) {
  return async (request: Request, segment: { params: Promise<P> | P }): Promise<NextResponse<ApiSuccess<T> | ApiFailure>> => {
    try {
      const params = await segment.params
      const playerId = await getPlayerId()
      return success(await handler({ playerId, params, request }), successStatus)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

/** Parse and validate a JSON body. Empty bodies are treated as {}. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = await request.text()
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
