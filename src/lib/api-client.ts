import type { ApiFailure, ApiSuccess } from '@/server/http'

export interface FieldIssue {
  path: string
  message: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  /** Per-field problems from server-side validation, keyed by field name. */
  readonly fields: Record<string, string>
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = {}
    if (Array.isArray(details)) {
      for (const d of details as FieldIssue[]) {
        if (d && typeof d.path === 'string' && typeof d.message === 'string' && !(d.path in this.fields)) this.fields[d.path] = d.message
      }
    }
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
  if (!json.ok) {
    // An expired or revoked session anywhere in the game sends the player back to log in.
    if (res.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    }
    throw new ApiError(json.error.code, json.error.message, res.status, json.error.details)
  }
  return json.data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
