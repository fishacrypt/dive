import { parseBody, route } from '@/server/http'
import { getAccount, updateUsername } from '@/server/services/auth'
import { updateAccountSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const GET = route(({ userId }) => getAccount(userId))
export const PATCH = route(async ({ userId, request }) => {
  const body = await parseBody(request, updateAccountSchema)
  return updateUsername(userId, body.username)
})
