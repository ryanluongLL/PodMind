import fs from "node:fs"
import path from "node:path"
import pg from "pg"

/// Shared by the integration tests and the end to end server. Both wipe and
/// rebuild a database on every run, so both go through the same safety check.

/// The schema files, applied in name order (001, 002, ...)
export const MIGRATIONS_DIR = "src/db/migrations"

/// Refuse to wipe any database whose name does not end in _test
export function assertTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1)
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}". The database name must end in _test.`)
  }
  return name
}

/// Creates the database if it does not exist, wipes it, and applies every
/// migration, so a run always starts from the real schema with no old data.
export async function resetDatabase(url: string, migrationsDir: string = MIGRATIONS_DIR): Promise<void> {
  const dbName = assertTestDatabase(url)

  /// Connect to the built in "postgres" database to create the test database
  const adminUrl = new URL(url)
  adminUrl.pathname = "/postgres"
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`)
    }
  } finally {
    await admin.end()
  }

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE")
    await client.query("CREATE SCHEMA public")

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}