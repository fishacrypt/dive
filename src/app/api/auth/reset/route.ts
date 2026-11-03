import { parseBody, publicRoute } from '@/server/http'
import { resetPassword } from '@/server/services/auth'
import { resetPasswordSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = publicRoute(async ({ request, ip, userAgent }) => {
  const body = await parseBody(request, resetPasswordSchema)
  await resetPassword(body.token, body.password, { ip, userAgent })
  return { reset: true }
})
