import { route } from '@/server/http'
import { getJob } from '@/server/services/jobs'

export const dynamic = 'force-dynamic'
export const GET = route<unknown, { id: string }>(({ playerId, params }) => getJob(playerId, params.id))
