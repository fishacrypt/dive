import { parseBody, route } from '@/server/http'
import { changePassword } from '@/server/services/auth'
import { changePasswordSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route(async ({ userId, sessionId, request }) => {
  const body = await parseBody(request, changePasswordSchema)
  await changePassword(userId, sessionId, body.currentPassword, body.newPassword)
  return { changed: true }
})
