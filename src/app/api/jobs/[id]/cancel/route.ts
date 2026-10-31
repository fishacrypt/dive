import { route } from '@/server/http'
import { cancelJob } from '@/server/services/jobs'

export const dynamic = 'force-dynamic'
export const POST = route<unknown, { id: string }>(({ playerId, params }) => cancelJob(playerId, params.id))
