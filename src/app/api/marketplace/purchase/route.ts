import { idempotencyKeyFrom, parseBody, route } from '@/server/http'
import { purchaseEquipment } from '@/server/services/marketplace'
import { purchaseSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, purchaseSchema)
  return purchaseEquipment(playerId, body.equipmentId, idempotencyKeyFrom(request, body.idempotencyKey))
}, 201)
