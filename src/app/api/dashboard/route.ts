import { route } from '@/server/http'
import { getDashboard } from '@/server/services/dashboard'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => getDashboard(playerId))
