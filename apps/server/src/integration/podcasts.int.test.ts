import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { pool } from "../db/index.js"
import { scrapeRSS } from "../scrapers/rss.js"
import { scrapePodbean } from "../scrapers/podbean.js"
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
      episodeUrl: "https://example.com/ep3",
      audioUrl: "https://example.com/ep3.mp3",
      iconUrl: null,
      publishedAt: new Date("2026-11-09T00:00:00Z"),
    })
    vi.mocked(scrapeRSS).mockResolvedValueOnce(withNewEpisode)
    await request(app).post("/podcasts").send({ url: FEED_URL })

    expect(await countRows("episodes")).toBe(3)
  })

  it("uses the Podbean scraper for Podbean pages", async () => {
    const url = "https://www.podbean.com/podcast-detail/abc123/Slow-English"
    vi.mocked(scrapePodbean).mockResolvedValue(fakeFeed())

    const res = await request(app).post("/podcasts").send({ url })

    expect(res.status).toBe(200)
    expect(scrapePodbean).toHaveBeenCalledWith(url)
    expect(scrapeRSS).not.toHaveBeenCalled()
    expect(res.body.podcast).toMatchObject({ podbean_url: url, rss_url: null })
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