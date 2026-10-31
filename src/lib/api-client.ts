import type { ApiFailure, ApiSuccess } from '@/server/http'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** Fresh random key so a double-clicked button can never charge twice. */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID()
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null
  if (!json) throw new ApiError('INTERNAL', 'The server returned an unreadable response.', res.status)
  if (!json.ok) throw new ApiError(json.error.code, json.error.message, res.status)
  return json.data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
