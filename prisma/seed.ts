/**
 * Seed script: catalog (equipment, challenge templates, achievements) and the
 * demo player. Safe to run repeatedly. All resources are simulated.
 *
 * Run with: bun run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { DEMO } from '../src/lib/game/config'
import { seedCatalog } from '../src/server/services/catalog-seed'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  await seedCatalog(prisma)
  // Imported lazily so the catalog exists before the demo player is provisioned.
  const { provisionPlayer } = await import('../src/server/services/demo')
  const handle = process.env.DEMO_PLAYER_HANDLE ?? DEMO.defaultHandle
  const existing = await prisma.player.findUnique({ where: { handle } })
  if (!existing) await provisionPlayer(handle, DEMO.displayName)
  console.log(`Seeded catalog and demo player "${handle}".`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
