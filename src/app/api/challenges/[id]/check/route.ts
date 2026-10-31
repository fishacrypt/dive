import { parseBody, route } from '@/server/http'
import { checkSolution } from '@/server/services/challenges'
import { checkSolutionSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const POST = route<unknown, { id: string }>(async ({ playerId, params, request }) => {
  const body = await parseBody(request, checkSolutionSchema)
  return checkSolution(playerId, params.id, body.solution)
})
