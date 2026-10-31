import { execSync } from 'node:child_process'
import { TEST_DATABASE_URL } from './test-env'

/** Create/migrate the test database and seed the catalog once per run. */
export default async function setup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL
  execSync('bunx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } })
  const { PrismaClient } = await import('@prisma/client')
  const { seedCatalog } = await import('../src/server/services/catalog-seed')
  const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
  await seedCatalog(db)
  await db.$disconnect()
}
