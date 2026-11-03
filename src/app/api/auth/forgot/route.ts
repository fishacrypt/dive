import { parseBody, publicRoute } from '@/server/http'
import { resolveBaseUrl } from '@/server/base-url'
import { requestPasswordReset } from '@/server/services/auth'
import { forgotPasswordSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
/** Same response whether or not the email is registered. */
export const POST = publicRoute(async ({ request, ip, userAgent }) => {
  const body = await parseBody(request, forgotPasswordSchema)
  const baseUrl = resolveBaseUrl(request)
  if (baseUrl) await requestPasswordReset(body.email, { ip, userAgent }, baseUrl)
  else console.warn('Password reset requested but APP_URL is not set; no email sent.')
  return { message: 'If that email is registered, a reset link is on its way.' }
})
