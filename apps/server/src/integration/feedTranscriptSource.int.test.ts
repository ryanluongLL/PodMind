import { describe, it, expect, vi } from "vitest"
import { pool } from "../db/index.js"
import { feedTranscriptFor } from "../transcripts/feedTranscriptSource.js"
import type { FetchLike } from "../transcripts/downloadTranscript.js"
import { insertEpisode, insertPodcast } from "./factories.js"

const SRT = "1\n00:00:00,000 --> 00:00:03,000\nWelcome to the show.\n"

async function episodeWithLink(url: string | null, format: string | null): Promise<string> {
  const podcastId = await insertPodcast()
  const episodeId = await insertEpisode(podcastId)
  await pool.query(`UPDATE episodes SET transcript_url = $1, transcript_format = $2 WHERE id = $3`, [
    url,
    format,
    episodeId,
  ])
  return episodeId
}

describe("feedTranscriptFor", () => {
  it("downloads the transcript saved for the episode", async () => {
    const episodeId = await episodeWithLink("https://example.com/ep1.srt", "srt")
    const fetchImpl: FetchLike = vi.fn(async () => new Response(SRT))

    const result = await feedTranscriptFor(episodeId, fetchImpl)

    expect(result).toEqual({
      fullText: "Welcome to the show.",
      segments: [{ start: 0, end: 3, text: "Welcome to the show." }],
    })
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/ep1.srt", expect.anything())
  })

  it("returns null without fetching when the episode has no link", async () => {
    const episodeId = await episodeWithLink(null, null)
    const fetchImpl: FetchLike = vi.fn(async () => new Response(SRT))

    expect(await feedTranscriptFor(episodeId, fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("returns null for an episode that does not exist", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(SRT))
    expect(await feedTranscriptFor("3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d", fetchImpl)).toBeNull()
  })

  it("returns null when the publisher's file is broken", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const episodeId = await episodeWithLink("https://example.com/ep1.vtt", "vtt")
    const fetchImpl: FetchLike = vi.fn(async () => new Response("Server error", { status: 500 }))

    expect(await feedTranscriptFor(episodeId, fetchImpl)).toBeNull()
  })
})