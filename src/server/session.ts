import { prisma } from './db'
import { DomainError } from './errors'
import { DEMO } from '@/lib/game/config'
import { provisionPlayer } from './services/demo'

/**
 * Demo-player session.
 *
 * IMPORTANT: this is NOT authentication. Every visitor shares one demo player.
 * It exists so the game is playable immediately. To add real auth, replace
 * `getPlayerId` with a function that reads a verified session (for example
 * from a signed cookie or an auth provider) and returns that user's player id.
 * Every service already takes `playerId` and checks ownership on each query,
 * so nothing else has to change.
 */
export async function getPlayerId(): Promise<string> {
  const handle = process.env.DEMO_PLAYER_HANDLE ?? DEMO.defaultHandle
  const existing = await prisma.player.findUnique({ where: { handle }, select: { id: true } })
  if (existing) return existing.id
  try {
    return await provisionPlayer(handle, DEMO.displayName)
  } catch (error) {
    if (error instanceof DomainError) throw error
    // A concurrent first request may have created the player already.
    const again = await prisma.player.findUnique({ where: { handle }, select: { id: true } })
    if (again) return again.id
    throw error
  }
}
