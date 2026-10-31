import { route } from '@/server/http'
import { claimJob } from '@/server/services/jobs'

export const dynamic = 'force-dynamic'
export const POST = route<unknown, { id: string }>(({ playerId, params }) => claimJob(playerId, params.id))
