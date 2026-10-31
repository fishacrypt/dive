import { parseBody, route } from '@/server/http'
import { assignComponent } from '@/server/services/rigs'
import { assignSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route<unknown, { id: string }>(async ({ playerId, params, request }) => {
  const body = await parseBody(request, assignSchema)
  return assignComponent(playerId, params.id, body.inventoryItemId)
}, 201)
