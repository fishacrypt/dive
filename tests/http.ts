import { randomUUID } from 'node:crypto'

type Handler<P> = (request: Request, segment: { params: Promise<P> | P }) => Promise<Response>

export interface Reply {
  status: number
  json: { ok: boolean; data?: any; error?: { code: string; message: string; details?: any } } // eslint-disable-line
  /** Value of the session cookie set by this response ('' when cleared, null if untouched). */
  sessionCookie: string | null
  headers: Headers
}

export interface CallOptions<P = Record<string, string>> {
  method?: string
  body?: unknown
  /** "name=value" session cookie to send. */
  cookie?: string | null
  ip?: string
  headers?: Record<string, string>
  params?: P
  query?: string
}

const COOKIE_NAME = 'dive_session'

/** Call an API route handler exactly as Next.js would: with a Request, cookies and params. */
export async function call<P = Record<string, string>>(handler: Handler<P>, opts: CallOptions<P> = {}): Promise<Reply> {
  const headers: Record<string, string> = { 'x-real-ip': opts.ip ?? `10.0.0.${Math.floor(Math.random() * 250)}-${randomUUID()}`, ...opts.headers }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.cookie) headers.cookie = opts.cookie
  const request = new Request(`http://localhost/api/test${opts.query ?? ''}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const res = await handler(request, { params: opts.params ?? ({} as P) })
  const text = await res.text()
  const setCookie = res.headers.get('set-cookie')
  let sessionCookie: string | null = null
  if (setCookie) {
    const match = new RegExp(`${COOKIE_NAME}=([^;]*)`).exec(setCookie)
    if (match) sessionCookie = match[1] ?? ''
  }
  return { status: res.status, json: text ? (JSON.parse(text) as Reply['json']) : { ok: false }, sessionCookie, headers: res.headers }
}

export const asCookie = (value: string | null | undefined): string | null => (value ? `${COOKIE_NAME}=${value}` : null)
