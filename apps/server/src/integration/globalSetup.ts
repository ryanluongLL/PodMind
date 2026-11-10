import fs from "node:fs"
import path from "node:path"
import pg from "pg"
import { TEST_DATABASE_URL, MIGRATIONS_DIR, assertTestDatabase } from "./testDatabase.js"

/// Runs once before all integration tests: creates the test database if it
/// does not exist, wipes it, and applies every migration, so each run starts
/// from the real schema with no leftover data.
export default async function setup(): Promise<void> {
  const dbName = assertTestDatabase(TEST_DATABASE_URL)

  /// Connect to the built in "postgres" database to create the test database
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = "/postgres"
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`)
  }
  await admin.end()

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE")
    await client.query("CREATE SCHEMA public")

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}