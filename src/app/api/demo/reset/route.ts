import { DEMO } from '@/lib/game/config'
import { route } from '@/server/http'
import { resetDemoPlayer } from '@/server/services/demo'

export const dynamic = 'force-dynamic'
export const POST = route(async () => {
  const handle = process.env.DEMO_PLAYER_HANDLE ?? DEMO.defaultHandle
  await resetDemoPlayer(handle, DEMO.displayName)
  return { reset: true }
})
