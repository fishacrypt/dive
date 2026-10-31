import { idempotencyKeyFrom, parseBody, route } from '@/server/http'
import { listJobs, startJob } from '@/server/services/jobs'
import { startJobSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => listJobs(playerId))
export const POST = route(async ({ playerId, request }) => {
  const body = await parseBody(request, startJobSchema)
  return startJob(playerId, { ...body, idempotencyKey: idempotencyKeyFrom(request, body.idempotencyKey) })
}, 201)
