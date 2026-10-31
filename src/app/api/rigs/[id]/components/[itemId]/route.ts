import { route } from '@/server/http'
import { removeComponent } from '@/server/services/rigs'

export const dynamic = 'force-dynamic'
export const DELETE = route<unknown, { id: string; itemId: string }>(({ playerId, params }) =>
  removeComponent(playerId, params.id, params.itemId),
)
