import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { pool } from "../db/index.js"
import { scrapeRSS } from "../scrapers/rss.js"
import { fakeFeed, insertPodcast, insertEpisode, insertTranscript } from "./factories.js"

const FEED_URL = "https://feeds.example.com/slow-english.rss"

async function countRows(table: "podcasts" | "episodes"): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM ${table}`)
  return rows[0]!.count
}

describe("POST /podcasts", () => {
  it("rejects a request without a URL", async () => {
    const res = await request(app).post("/podcasts").send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "URL is required" })
    expect(scrapeRSS).not.toHaveBeenCalled()
  })

  it("rejects a URL that is not http", async () => {
    const res = await request(app).post("/podcasts").send({ url: "ftp://example.com/feed" })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "Invalid URL" })
  })

  it("adds an RSS podcast and its episodes", async () => {
    vi.mocked(scrapeRSS).mockResolvedValue(fakeFeed())

    const res = await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(res.status).toBe(200)
    expect(res.body.episodeCount).toBe(2)
    expect(res.body.podcast).toMatchObject({
      name: "Slow English Stories",
      rss_url: FEED_URL,
      podbean_url: null,
      icon_url: "https://example.com/art.jpg",
    })
    expect(scrapeRSS).toHaveBeenCalledWith(FEED_URL)
    expect(await countRows("episodes")).toBe(2)
  })

  it("uses the artwork sent by the browser over the feed's artwork", async () => {
    vi.mocked(scrapeRSS).mockResolvedValue(fakeFeed())
    const res = await request(app)
      .post("/podcasts")
      .send({ url: FEED_URL, iconUrl: "https://itunes.example.com/big.jpg" })
    expect(res.body.podcast.icon_url).toBe("https://itunes.example.com/big.jpg")
  })

  it("adding the same feed twice updates the podcast instead of duplicating it", async () => {
    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed())
    const first = await request(app).post("/podcasts").send({ url: FEED_URL })

    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed({ name: "Slow English Stories (new name)" }))
    const second = await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(second.status).toBe(200)
    expect(second.body.podcast.id).toBe(first.body.podcast.id)
    expect(second.body.podcast.name).toBe("Slow English Stories (new name)")
    expect(await countRows("podcasts")).toBe(1)
    expect(await countRows("episodes")).toBe(2)
  })

  it("adds only the new episodes when a feed is added again", async () => {
    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed())
    await request(app).post("/podcasts").send({ url: FEED_URL })

    const withNewEpisode = fakeFeed()
    withNewEpisode.episodes.unshift({
      title: "Episode 3",
      guid: "episode-3",
      episodeUrl: "https://example.com/ep3",
      audioUrl: "https://example.com/ep3.mp3",
      iconUrl: null,
      publishedAt: new Date("2026-11-09T00:00:00Z"),
    })
    vi.mocked(scrapeRSS).mockResolvedValueOnce(withNewEpisode)
    await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(await countRows("episodes")).toBe(3)
  })

  it("keeps episodes apart when every episode links to the same homepage", async () => {
    const feed = fakeFeed()
    for (const episode of feed.episodes) {
      episode.episodeUrl = "https://example.com"
    }
    vi.mocked(scrapeRSS).mockResolvedValue(feed)

    await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(await countRows("episodes")).toBe(2)
  })

  it("lets two podcasts link their episodes to the same page", async () => {
    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed())
    await request(app).post("/podcasts").send({ url: FEED_URL })

    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed({ name: "Another Show" }))
    await request(app).post("/podcasts").send({ url: "https://feeds.example.com/another.rss" })

    expect(await countRows("episodes")).toBe(4)
  })

  it("gives an episode saved before guids existed its guid instead of copying it", async () => {
    const podcastId = await insertPodcast("Slow English Stories", FEED_URL)
    await pool.query(
      `INSERT INTO episodes (podcast_id, title, episode_url) VALUES ($1, 'Episode 1', 'https://example.com/ep1')`,
      [podcastId]
    )
    vi.mocked(scrapeRSS).mockResolvedValue(fakeFeed())

    await request(app).post("/podcasts").send({ url: FEED_URL })

    const { rows } = await pool.query(`SELECT title, guid FROM episodes ORDER BY title`)
    expect(rows).toEqual([
      { title: "Episode 1", guid: "episode-1" },
      { title: "Episode 2", guid: "episode-2" },
    ])
  })

  it("saves the transcript link the publisher puts in the feed", async () => {
    const feed = fakeFeed()
    feed.episodes[0]!.transcript = { url: "https://example.com/ep2.vtt", format: "vtt" }
    vi.mocked(scrapeRSS).mockResolvedValue(feed)

    await request(app).post("/podcasts").send({ url: FEED_URL })

    const { rows } = await pool.query(
      `SELECT title, transcript_url, transcript_format FROM episodes ORDER BY title`
    )
    expect(rows).toEqual([
      { title: "Episode 1", transcript_url: null, transcript_format: null },
      { title: "Episode 2", transcript_url: "https://example.com/ep2.vtt", transcript_format: "vtt" },
    ])
  })

  it("adds a transcript link that appears after the episode was saved", async () => {
    vi.mocked(scrapeRSS).mockResolvedValueOnce(fakeFeed())
    await request(app).post("/podcasts").send({ url: FEED_URL })

    const later = fakeFeed()
    later.episodes[1]!.transcript = { url: "https://example.com/ep1.srt", format: "srt" }
    vi.mocked(scrapeRSS).mockResolvedValueOnce(later)
    await request(app).post("/podcasts").send({ url: FEED_URL })

    const { rows } = await pool.query(
      `SELECT transcript_url, transcript_format FROM episodes WHERE title = 'Episode 1'`
    )
    expect(rows).toEqual([{ transcript_url: "https://example.com/ep1.srt", transcript_format: "srt" }])
    expect(await countRows("episodes")).toBe(2)
  })

  it("turns away Podbean pages with a pointer to the feed", async () => {
    const res = await request(app)
      .post("/podcasts")
      .send({ url: "https://www.podbean.com/podcast-detail/abc123/Slow-English" })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: "Podbean pages are not supported. Search for the podcast, or paste its RSS feed URL.",
    })
    expect(scrapeRSS).not.toHaveBeenCalled()
  })

  it("answers 500 and saves nothing when the feed cannot be read", async () => {
    vi.mocked(scrapeRSS).mockRejectedValue(new Error("feed timed out"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Failed to scrape podcast" })
    expect(await countRows("podcasts")).toBe(0)
  })
})

describe("GET /podcasts", () => {
  it("returns an empty list for an empty library", async () => {
    const res = await request(app).get("/podcasts")
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it("lists podcasts newest first with their episode counts", async () => {
    const older = await insertPodcast("Older Show")
    await insertEpisode(older)
    await pool.query(`UPDATE podcasts SET created_at = now() - interval '1 day' WHERE id = $1`, [older])
    const newer = await insertPodcast("Newer Show")
    await insertEpisode(newer)
    await insertEpisode(newer)
    await insertPodcast("Empty Show")
    await pool.query(`UPDATE podcasts SET created_at = now() - interval '2 days' WHERE name = 'Empty Show'`)

    const res = await request(app).get("/podcasts")

    expect(res.status).toBe(200)
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(["Newer Show", "Older Show", "Empty Show"])
    expect(res.body.map((p: { episode_count: number }) => p.episode_count)).toEqual([2, 1, 0])
  })
})

describe("GET /podcasts/:id", () => {
  it("returns the podcast with episodes newest first and their transcript status", async () => {
    const podcastId = await insertPodcast("Show")
    const old = await insertEpisode(podcastId, { title: "Old", publishedAt: "2026-01-01T00:00:00Z" })
    await insertEpisode(podcastId, { title: "Undated", publishedAt: null })
    await insertEpisode(podcastId, { title: "New", publishedAt: "2026-11-01T00:00:00Z" })
    await insertTranscript(old, { status: "done", fullText: "Hello there." })

    const res = await request(app).get(`/podcasts/${podcastId}`)

    expect(res.status).toBe(200)
    expect(res.body.podcast.name).toBe("Show")
    expect(res.body.episodes.map((e: { title: string }) => e.title)).toEqual(["New", "Old", "Undated"])
    expect(res.body.episodes.map((e: { transcript_status: string | null }) => e.transcript_status)).toEqual([
      null,
      "done",
      null,
    ])
  })

  it("answers 404 for a podcast that does not exist", async () => {
    const res = await request(app).get("/podcasts/3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Podcast not found" })
  })

  it("answers 404, not 500, for a malformed id", async () => {
    const res = await request(app).get("/podcasts/not-a-real-id")
    expect(res.status).toBe(404)
  })
})