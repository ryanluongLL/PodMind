import { resetDatabase } from "../testing/database.js"
import { TEST_DATABASE_URL } from "./testDatabase.js"

/// Runs once before all integration tests: creates the test database if it
/// does not exist, wipes it, and applies every migration, so each run starts
/// from the real schema with no leftover data.
export default async function setup(): Promise<void> {
  await resetDatabase(TEST_DATABASE_URL)
}