import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { embedQuery } from "../services/embeddings.js"
import { insertPodcast, insertEpisode, insertEmbedding, axisVector } from "./factories.js"

describe("GET /search", () => {
  it("returns the closest transcript chunks first, using pgvector", async () => {
    const podcastId = await insertPodcast("Money Talk")
    const episodeId = await insertEpisode(podcastId, { title: "Saving tips" })
    await insertEmbedding(episodeId, 0, "How to open a savings account.", axisVector(0))
    await insertEmbedding(episodeId, 1, "My trip to the mountains.", axisVector(1))
    vi.mocked(embedQuery).mockResolvedValue(axisVector(0))

    const res = await request(app).get("/search").query({ q: "  savings account  " })

    expect(res.status).toBe(200)
    expect(res.body.query).toBe("savings account")
    expect(embedQuery).toHaveBeenCalledWith("savings account")
    expect(res.body.results.map((r: { chunk_text: string }) => r.chunk_text)).toEqual([
      "How to open a savings account.",
      "My trip to the mountains.",
    ])
    expect(res.body.results[0]).toMatchObject({
      episode_id: episodeId,
      episode_title: "Saving tips",
      podcast_name: "Money Talk",
      chunk_index: 0,
    })
    expect(res.body.results[0].similarity).toBeCloseTo(1, 5)
    expect(res.body.results[1].similarity).toBeCloseTo(0, 5)
  })

  it("returns at most 10 results", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    for (let i = 0; i < 15; i++) {
      await insertEmbedding(episodeId, i, `chunk ${i}`, axisVector(i))
    }
    vi.mocked(embedQuery).mockResolvedValue(axisVector(3))

    const res = await request(app).get("/search").query({ q: "anything" })

    expect(res.body.results).toHaveLength(10)
    expect(res.body.results[0].chunk_text).toBe("chunk 3")
  })

  it("returns an empty list for an empty library", async () => {
    vi.mocked(embedQuery).mockResolvedValue(axisVector(0))
    const res = await request(app).get("/search").query({ q: "anything" })
    expect(res.status).toBe(200)
    expect(res.body.results).toEqual([])
  })

  it("rejects missing, blank, repeated, or very long queries without calling OpenAI", async () => {
    expect((await request(app).get("/search")).status).toBe(400)
    expect((await request(app).get("/search?q=%20%20")).status).toBe(400)
    expect((await request(app).get("/search?q=a&q=b")).status).toBe(400)
    expect((await request(app).get("/search").query({ q: "x".repeat(201) })).status).toBe(400)
    expect(embedQuery).not.toHaveBeenCalled()
  })

  it("answers 500 when OpenAI fails", async () => {
    vi.mocked(embedQuery).mockRejectedValue(new Error("rate limited"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await request(app).get("/search").query({ q: "anything" })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Search failed" })
  })
})