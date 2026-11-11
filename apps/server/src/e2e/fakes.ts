import http from "node:http"
import type pg from "pg"

/// Stand ins for everything outside PodMind that the end to end tests would
/// otherwise reach: DeepL, a podcast's RSS feed, and its cover art. They
/// answer in the same format as the real services, so the app code runs
/// unchanged. Two extra routes let the browser tests reset and seed data.
///
/// This file only runs during end to end tests and is left out of the build.

export const FAKE_FEED_PATH = "/feed.xml"
export const SEED_PODCAST_NAME = "Slow English Stories"

/// Fixed answers for the words the tests click. Any other word comes back
/// as "[lang] word", which is easy to spot if a test clicks the wrong one.
const TRANSLATIONS: Record<string, Record<string, string>> = {
  bank: { ES: "banco", VI: "ngân hàng" },
  river: { ES: "río", VI: "sông" },
}

/// Lines for the seeded transcript. "bank" appears with two meanings, so the
/// tests can check that the popup picks the one that fits the sentence.
export const SEED_SEGMENTS = [
  { start: 0, end: 4, text: "Welcome back to Slow English Stories." },
  { start: 4, end: 9, text: "Today I need to deposit money at the bank." },
  { start: 9, end: 14, text: "Later we walked along the bank of the river." },
  { start: 14, end: 19, text: "The bank gave her a loan to buy a small house." },
]

/// A 1x1 grey PNG, so cover images load without hitting the internet
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+P9/PQAI6gN9yJ6wTAAAAABJRU5ErkJggg==",
  "base64"
)

function feedXml(baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${SEED_PODCAST_NAME}</title>
    <link>${baseUrl}</link>
    <description>Short, slow stories for English learners.</description>
    <language>en-us</language>
    <image><url>${baseUrl}/art.png</url><title>${SEED_PODCAST_NAME}</title><link>${baseUrl}</link></image>
    <item>
      <title>A Day at the Bank</title>
      <link>${baseUrl}/episodes/2</link>
      <guid>${baseUrl}/episodes/2</guid>
      <pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate>
      <enclosure url="${baseUrl}/audio/2.mp3" type="audio/mpeg" length="1000"/>
      <itunes:duration>6:30</itunes:duration>
    </item>
    <item>
      <title>Meeting New Friends</title>
      <link>${baseUrl}/episodes/1</link>
      <guid>${baseUrl}/episodes/1</guid>
      <pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate>
      <enclosure url="${baseUrl}/audio/1.mp3" type="audio/mpeg" length="1000"/>
      <itunes:duration>7:10</itunes:duration>
    </item>
  </channel>
</rss>`
}

/// deepl-node sends form data for translations and JSON for some other
/// calls, so the fake reads both
async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString("utf8")
  if (raw.length === 0) {
    return {}
  }
  if ((req.headers["content-type"] ?? "").includes("application/json")) {
    return JSON.parse(raw) as Record<string, unknown>
  }
  const form = new URLSearchParams(raw)
  const body: Record<string, unknown> = {}
  for (const key of form.keys()) {
    const values = form.getAll(key)
    if (values.length > 1 || key === "text") {
      body[key] = values
    } else {
      body[key] = values[0]
    }
  }
  return body
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

/// DeepL's POST /v2/translate: { text: [...], target_lang } in, one
/// translation per text out
function fakeTranslate(body: Record<string, unknown>): { translations: { detected_source_language: string; text: string }[] } {
  const target = String(body.target_lang ?? "").toUpperCase().split("-")[0] ?? ""
  let texts: string[] = []
  if (Array.isArray(body.text)) {
    texts = body.text.map((t) => String(t))
  }
  return {
    translations: texts.map((text) => {
      const known = TRANSLATIONS[text.toLowerCase()]?.[target]
      return { detected_source_language: "EN", text: known ?? `[${target.toLowerCase()}] ${text}` }
    }),
  }
}

/// Puts one podcast with one fully transcribed episode in the library, as if
/// the transcription worker had already finished it
async function seedTranscribedEpisode(pool: pg.Pool, baseUrl: string): Promise<{ podcastId: string; episodeId: string }> {
  const podcast = await pool.query<{ id: string }>(
    `INSERT INTO podcasts (name, rss_url, icon_url) VALUES ($1, $2, $3) RETURNING id`,
    [SEED_PODCAST_NAME, `${baseUrl}${FAKE_FEED_PATH}`, `${baseUrl}/art.png`]
  )
  const podcastId = podcast.rows[0]!.id

  const episode = await pool.query<{ id: string }>(
    `INSERT INTO episodes (podcast_id, title, episode_url, audio_url, published_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [podcastId, "A Day at the Bank", `${baseUrl}/episodes/2`, `${baseUrl}/audio/2.mp3`, "2026-11-02T08:00:00Z"]
  )
  const episodeId = episode.rows[0]!.id

  const fullText = SEED_SEGMENTS.map((s) => s.text).join(" ")
  await pool.query(
    `INSERT INTO transcripts (episode_id, full_text, segments, status) VALUES ($1, $2, $3, 'done')`,
    [episodeId, fullText, JSON.stringify(SEED_SEGMENTS)]
  )
  return { podcastId, episodeId }
}

export function createFakesServer(pool: pg.Pool, baseUrl: string): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", baseUrl)

    const handle = async (): Promise<void> => {
      if (req.method === "POST" && url.pathname === "/v2/translate") {
        sendJson(res, 200, fakeTranslate(await readBody(req)))
        return
      }
      if (req.method === "GET" && url.pathname === FAKE_FEED_PATH) {
        res.writeHead(200, { "Content-Type": "application/rss+xml" })
        res.end(feedXml(baseUrl))
        return
      }
      if (req.method === "GET" && url.pathname === "/art.png") {
        res.writeHead(200, { "Content-Type": "image/png" })
        res.end(PIXEL_PNG)
        return
      }

      /// Test control: empty the library before each test. The dictionary
      /// stays, since tests only read from it.
      if (req.method === "POST" && url.pathname === "/__reset") {
        await pool.query(
          `TRUNCATE podcasts, episodes, transcripts, embeddings, translation_cache RESTART IDENTITY CASCADE`
        )
        sendJson(res, 200, { ok: true })
        return
      }
      if (req.method === "POST" && url.pathname === "/__seed/transcribed-episode") {
        sendJson(res, 200, await seedTranscribedEpisode(pool, baseUrl))
        return
      }

      sendJson(res, 404, { error: `No fake for ${req.method} ${url.pathname}` })
    }

    handle().catch((err: unknown) => {
      console.error("[e2e fakes] failed", err)
      sendJson(res, 500, { error: "fake server error" })
    })
  })
}