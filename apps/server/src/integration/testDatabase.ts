/// Where the integration tests run. This is a separate database from the one
/// "npm run dev" uses, and every test run wipes it, so it must never point at
/// real data. Override with TEST_DATABASE_URL (CI does this).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://podmind:podmind@localhost:5432/podmind_test"

/// The schema files, applied in name order (001, 002, ...) on every run
export const MIGRATIONS_DIR = "src/db/migrations"

/// Safety check: refuse to wipe any database whose name does not end in _test
export function assertTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1)
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests against "${name}". The database name must end in _test.`)
  }
  return name
}