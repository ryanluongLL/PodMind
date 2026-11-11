import os from "node:os"
import path from "node:path"
import { resetDatabase } from "../testing/database.js"

/// Starts PodMind's API for the browser tests, next to fakes for DeepL and a
/// podcast feed, on a fresh database. Playwright runs this before the tests
/// (see apps/web/playwright.config.ts) and stops it afterwards.
///
/// The real app code runs unchanged. Only its settings differ: the database
/// is podmind_e2e_test, and DeepL's address points at the local fake. The
/// transcription worker is not started, since tests seed finished transcripts.

const API_PORT = Number(process.env.E2E_API_PORT ?? 3101)
const FAKES_PORT = Number(process.env.E2E_FAKES_PORT ?? 3102)
const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? "http://localhost:3100"
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://podmind:podmind@localhost:5432/podmind_e2e_test"
const FAKES_URL = `http://localhost:${FAKES_PORT}`

/// Settings must be in place before the app is imported, since the database
/// pool and the CORS list read them when their modules load
process.env.DATABASE_URL = DATABASE_URL
process.env.FRONTEND_URL = WEB_ORIGIN
process.env.DEEPL_API_KEY = "e2e-key"
process.env.DEEPL_SERVER_URL = FAKES_URL
process.env.OPENAI_API_KEY = "e2e-key"
process.env.AUDIO_CACHE_DIR = path.join(os.tmpdir(), "podmind-e2e-audio")

await resetDatabase(DATABASE_URL)

const { app } = await import("../app.js")
const { pool } = await import("../db/index.js")
const { createFakesServer } = await import("./fakes.js")
const { seedDictionary } = await import("./seedDictionary.js")

await seedDictionary(pool)

createFakesServer(pool, FAKES_URL).listen(FAKES_PORT, () => {
  console.log(`[e2e] fake services on ${FAKES_URL}`)
})
app.listen(API_PORT, () => {
  console.log(`[e2e] API on http://localhost:${API_PORT} using ${new URL(DATABASE_URL).pathname.slice(1)}`)
})