import { parseBody, publicRoute } from '@/server/http'
import { loginUser } from '@/server/services/auth'
import { loginSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = publicRoute(async ({ request, cookies, ip, userAgent }) => {
  const body = await parseBody(request, loginSchema)
  const { user, session } = await loginUser(body, { ip, userAgent })
  cookies.setSession(session.token, session.expiresAt)
  return { username: user.username }
})
