import { describe, it, expect, beforeAll, afterAll } from "vitest"
import fs from "node:fs"
import path from "node:path"
import request from "supertest"
import { app } from "../app.js"

/// The route reads AUDIO_CACHE_DIR, which the integration config points at a
/// temporary folder. A fake "mp3" of known bytes makes ranges easy to check.
const dir = process.env.AUDIO_CACHE_DIR ?? ""
const EPISODE_ID = "3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d"
const MISSING_ID = "11111111-2222-4333-8444-555555555555"
const BYTES = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256))

/// Supertest buffers audio bodies when asked to
function getAudio(id: string, range?: string) {
  const req = request(app)
    .get(`/audio/${id}`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => done(null, Buffer.concat(chunks)))
    })
  if (range) {
    req.set("Range", range)
  }
  return req
}

beforeAll(() => {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${EPISODE_ID}.mp3`), BYTES)
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("GET /audio/:episodeId", () => {
  it("sends the whole file when no range is asked for", async () => {
    const res = await getAudio(EPISODE_ID)
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toBe("audio/mpeg")
    expect(res.headers["accept-ranges"]).toBe("bytes")
    expect(res.headers["content-length"]).toBe("1000")
    expect(Buffer.compare(res.body as Buffer, BYTES)).toBe(0)
  })

  it("sends exactly the requested bytes so the player can seek", async () => {
    const res = await getAudio(EPISODE_ID, "bytes=100-199")
    expect(res.status).toBe(206)
    expect(res.headers["content-range"]).toBe("bytes 100-199/1000")
    expect(res.headers["content-length"]).toBe("100")
    expect(Buffer.compare(res.body as Buffer, BYTES.subarray(100, 200))).toBe(0)
  })

  it("handles open ended and suffix ranges", async () => {
    const tail = await getAudio(EPISODE_ID, "bytes=900-")
    expect(tail.headers["content-range"]).toBe("bytes 900-999/1000")

    const last = await getAudio(EPISODE_ID, "bytes=-50")
    expect(last.status).toBe(206)
    expect(last.headers["content-range"]).toBe("bytes 950-999/1000")
    expect(Buffer.compare(last.body as Buffer, BYTES.subarray(950))).toBe(0)
  })

  it("answers 416 for a range past the end of the file", async () => {
    const res = await getAudio(EPISODE_ID, "bytes=5000-6000")
    expect(res.status).toBe(416)
    expect(res.headers["content-range"]).toBe("bytes */1000")
  })

  it("answers 404 for audio that is not cached yet", async () => {
    const res = await request(app).get(`/audio/${MISSING_ID}`)
    expect(res.status).toBe(404)
  })

  it("rejects ids that are not uuids, including path tricks", async () => {
    expect((await request(app).get("/audio/not-an-id")).status).toBe(400)
    expect((await request(app).get(`/audio/${"-".repeat(36)}`)).status).toBe(400)
    expect((await request(app).get("/audio/..%2F..%2Fpackage.json")).status).toBe(400)
  })
})