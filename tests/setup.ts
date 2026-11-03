import '@testing-library/jest-dom/vitest'
import { TEST_DATABASE_URL } from './test-env'

// Must happen before any module creates a Prisma client.
process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.EMAIL_TRANSPORT = 'memory'
process.env.APP_URL = 'https://dive.test'
process.env.CRON_SECRET = 'test-cron-secret-value'
