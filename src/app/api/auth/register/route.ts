import { parseBody, publicRoute } from '@/server/http'
import { registerUser } from '@/server/services/auth'
import { registerSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = publicRoute(async ({ request, cookies, ip, userAgent }) => {
  const body = await parseBody(request, registerSchema)
  const { user, session } = await registerUser(body, { ip, userAgent })
  cookies.setSession(session.token, session.expiresAt)
  return { username: user.username }
}, 201)
