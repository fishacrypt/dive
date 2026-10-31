import { route } from '@/server/http'
import { getProgression } from '@/server/services/progression'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => getProgression(playerId))
