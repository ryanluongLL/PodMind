import { vi, beforeEach, afterAll } from "vitest"
import { pool } from "../db/index.js"

/// Loaded before every integration test file.
///
/// The database is real. Everything that would leave this machine or needs
/// Redis is replaced with a fake, so tests are fast, free, and never flaky
/// because of someone else's server. Each test sets what the fakes return.
vi.mock("../scrapers/rss.js", () => ({ scrapeRSS: vi.fn() }))
vi.mock("../scrapers/podbean.js", () => ({ scrapePodbean: vi.fn() }))
vi.mock("../jobs/queue.js", () => ({ enqueueTranscription: vi.fn() }))

/// Every test starts with an empty library. Dictionary tables are left
/// alone, since tests only read from them.
beforeEach(async () => {
  vi.clearAllMocks()
  await pool.query("TRUNCATE podcasts, episodes, transcripts RESTART IDENTITY CASCADE")
})

afterAll(async () => {
  await pool.end()
})