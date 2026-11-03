/**
 * Public base URL used in emailed links. Set APP_URL in production. Request
 * headers are only trusted in development, because a forged Host header could
 * otherwise point a reset link at an attacker's site.
 */
export function resolveBaseUrl(request: Request): string | null {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return null
  return new URL(request.url).origin
}
