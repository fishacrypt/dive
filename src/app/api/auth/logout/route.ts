import { prisma } from '@/server/db'
import { hashToken } from '@/server/auth/tokens'
import { readCookie, SESSION_COOKIE } from '@/server/auth/session'
import { parseBody, publicRoute } from '@/server/http'
import { logoutSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
/** Always succeeds and always clears the cookie, even if the session was already gone. */
export const POST = publicRoute(async ({ request, cookies }) => {
  const body = await parseBody(request, logoutSchema)
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE)
  if (token) {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } })
    if (session) {
      await prisma.session.deleteMany({ where: body.everywhere ? { userId: session.userId } : { id: session.id } })
    }
  }
  cookies.clearSession()
  return { loggedOut: true }
})
