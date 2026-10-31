import { parseBody, route } from '@/server/http'
import { createRig, listRigs } from '@/server/services/rigs'
import { rigNameSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => listRigs(playerId))
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, rigNameSchema)
  return createRig(playerId, body.name)
}, 201)
