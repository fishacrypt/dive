import { parseBody, route } from '@/server/http'
import { generateInstance, listChallenges } from '@/server/services/challenges'
import { generateChallengeSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => listChallenges(playerId))
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, generateChallengeSchema)
  return generateInstance(playerId, body.definitionId)
}, 201)
