import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { pool } from "../db/index.js"
import { enqueueTranscription } from "../jobs/queue.js"
import { insertPodcast, insertEpisode, insertTranscript } from "./factories.js"

const MISSING_ID = "3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d"

describe("POST /episodes/:id/transcribe", () => {
  it("creates a pending transcript and enqueues one job", async () => {
    const episodeId = await insertEpisode(await insertPodcast(), { audioUrl: "https://example.com/a.mp3" })

    const res = await request(app).post(`/episodes/${episodeId}/transcribe`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "Transcription job enqueued", episodeId })
    expect(enqueueTranscription).toHaveBeenCalledTimes(1)
    expect(enqueueTranscription).toHaveBeenCalledWith(episodeId, "https://example.com/a.mp3")

    const { rows } = await pool.query(`SELECT status FROM transcripts WHERE episode_id = $1`, [episodeId])
    expect(rows).toEqual([{ status: "pending" }])
  })

  it("never enqueues the same episode twice, even when two requests arrive together", async () => {
    const episodeId = await insertEpisode(await insertPodcast())

    const [a, b] = await Promise.all([
      request(app).post(`/episodes/${episodeId}/transcribe`),
      request(app).post(`/episodes/${episodeId}/transcribe`),
    ])

    expect([a.body.message, b.body.message].sort()).toEqual([
      "Already transcribed or in progress",
      "Transcription job enqueued",
    ])
    expect(enqueueTranscription).toHaveBeenCalledTimes(1)
  })

  it("does not enqueue an episode that is already transcribed", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    await insertTranscript(episodeId, { status: "done", fullText: "Hi." })

    const res = await request(app).post(`/episodes/${episodeId}/transcribe`)

    expect(res.body.message).toBe("Already transcribed or in progress")
    expect(enqueueTranscription).not.toHaveBeenCalled()
  })

  it("answers 404 for an episode without audio", async () => {
    const episodeId = await insertEpisode(await insertPodcast(), { audioUrl: null })
    const res = await request(app).post(`/episodes/${episodeId}/transcribe`)
    expect(res.status).toBe(404)
    expect(enqueueTranscription).not.toHaveBeenCalled()
  })

  it("answers 404 for missing and malformed ids", async () => {
    expect((await request(app).post(`/episodes/${MISSING_ID}/transcribe`)).status).toBe(404)
    expect((await request(app).post("/episodes/abc/transcribe")).status).toBe(404)
  })
})

describe("POST /episodes/:id/rate-difficulty", () => {
  it("rates a finished transcript and saves the result on the episode", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    const sentence = "I am here. You are there. We go now. "
    const fullText = sentence.repeat(10).trim()
    await insertTranscript(episodeId, {
      status: "done",
      fullText,
      segments: [
        { start: 0, end: 30, text: "first half" },
        { start: 30, end: 60, text: "second half" },
      ],
    })

    const res = await request(app).post(`/episodes/${episodeId}/rate-difficulty`)

    expect(res.status).toBe(200)
    expect(res.body.wordsPerMinute).toBe(90)
    expect(res.body.level).toBe("A1")
    expect(res.body.reason).toContain("90 wpm")

    const { rows } = await pool.query(`SELECT difficulty, words_per_minute FROM episodes WHERE id = $1`, [episodeId])
    expect(rows[0]).toEqual({ difficulty: "A1", words_per_minute: 90 })
  })

  it("answers 404 while the transcript is still being made", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    await insertTranscript(episodeId, { status: "processing" })

    const res = await request(app).post(`/episodes/${episodeId}/rate-difficulty`)
    expect(res.status).toBe(404)
  })

  it("answers 404 for missing and malformed ids", async () => {
    expect((await request(app).post(`/episodes/${MISSING_ID}/rate-difficulty`)).status).toBe(404)
    expect((await request(app).post("/episodes/abc/rate-difficulty")).status).toBe(404)
  })
})

describe("server basics", () => {
  it("reports healthy when the database is reachable", async () => {
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ok")
  })

  it("answers unknown routes with JSON 404", async () => {
    const res = await request(app).get("/nothing-here")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Not found" })
  })

  it("answers JSON 500 without leaking details when the database fails", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("connection lost to 10.0.0.5"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await request(app).get("/podcasts")

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Something went wrong" })
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.5")
  })

  it("allows the local frontend through CORS", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000")
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000")
  })

  it("does not allow other websites through CORS", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example.com")
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })
})