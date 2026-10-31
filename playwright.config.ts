import { defineConfig, devices } from '@playwright/test'

const E2E_PORT = 5174
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/dive_e2e?schema=public'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // If your machine lacks system libraries for Chromium, set LD_LIBRARY_PATH before running (see README).
  webServer: {
    // Own database and own Next.js output folder, so the playable demo data is never touched.
    command: `bunx prisma migrate deploy && bun ./prisma/seed.ts && bunx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/dashboard`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DB,
      DEMO_PLAYER_HANDLE: 'e2e-player',
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
