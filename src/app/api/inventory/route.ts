import { route } from '@/server/http'
import { listInventory } from '@/server/services/marketplace'

export const dynamic = 'force-dynamic'
export const GET = route(({ playerId }) => listInventory(playerId))
