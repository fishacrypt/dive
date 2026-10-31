import '@testing-library/jest-dom/vitest'
import { TEST_DATABASE_URL } from './test-env'

// Must happen before any module creates a Prisma client.
process.env.DATABASE_URL = TEST_DATABASE_URL
