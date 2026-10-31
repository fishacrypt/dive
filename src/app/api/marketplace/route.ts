import { route } from '@/server/http'
import { listMarketplace } from '@/server/services/marketplace'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => listMarketplace(playerId))
