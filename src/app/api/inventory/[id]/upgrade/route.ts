import { idempotencyKeyFrom, parseBody, route } from '@/server/http'
import { upgradeItem } from '@/server/services/marketplace'
import { upgradeSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route<unknown, { id: string }>(async ({ playerId, params, request }) => {
  const body = await parseBody(request, upgradeSchema)
  return upgradeItem(playerId, params.id, idempotencyKeyFrom(request, body.idempotencyKey))
})
