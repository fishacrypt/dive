import { idempotencyKeyFrom, parseBody, route } from '@/server/http'
import { exchangeQuanta } from '@/server/services/economy'
import { exchangeSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, exchangeSchema)
  return exchangeQuanta(playerId, body.quanta, idempotencyKeyFrom(request, body.idempotencyKey))
})
