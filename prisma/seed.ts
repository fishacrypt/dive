/**
 * Seed script: the game catalog (equipment, challenge templates, achievements).
 * Safe to run repeatedly. It does NOT create any player: players register.
 *
 * Run with: bun run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { seedCatalog } from '../src/server/services/catalog-seed'

const prisma = new PrismaClient()

seedCatalog(prisma)
  .then(() => console.log('Seeded the game catalog.'))
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
