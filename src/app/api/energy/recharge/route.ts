import { idempotencyKeyFrom, parseBody, route } from '@/server/http'
import { rechargeEnergy } from '@/server/services/economy'
import { rechargeSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, rechargeSchema)
  return rechargeEnergy(playerId, body.packs, idempotencyKeyFrom(request, body.idempotencyKey))
})
