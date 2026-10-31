/** Tests use their own database so they never touch the playable demo data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/dive_test?schema=public'
