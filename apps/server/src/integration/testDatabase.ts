/// Where the integration tests run. This is a separate database from the one
/// "npm run dev" uses, and every test run wipes it, so it must never point at
/// real data. Override with TEST_DATABASE_URL (CI does this).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://podmind:podmind@localhost:5432/podmind_test"

export { MIGRATIONS_DIR, assertTestDatabase } from "../testing/database.js"