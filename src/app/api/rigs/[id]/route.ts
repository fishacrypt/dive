import { parseBody, route } from '@/server/http'
import { deleteRig, getRig, renameRig } from '@/server/services/rigs'
import { rigNameSchema } from '@/lib/validation'

type P = { id: string }
export const dynamic = 'force-dynamic'
export const GET = route<unknown, P>(({ playerId, params }) => getRig(playerId, params.id))
export const PATCH = route<unknown, P>(async ({ playerId, params, request }) => {
  const body = await parseBody(request, rigNameSchema)
  return renameRig(playerId, params.id, body.name)
})
export const DELETE = route<unknown, P>(({ playerId, params }) => deleteRig(playerId, params.id))
