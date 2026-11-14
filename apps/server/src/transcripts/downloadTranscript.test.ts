import { describe, it, expect, vi, beforeEach } from "vitest"
import { downloadTranscript, MAX_TRANSCRIPT_BYTES, type FetchLike } from "./downloadTranscript.js"

const URL = "https://example.com/ep1.vtt"
const VTT = "WEBVTT\n\n00:00.000 --> 00:02.000\nHello there.\n\n00:02.000 --> 00:04.000\nWelcome back."

function fakeFetch(body: string, init: ResponseInit = {}): FetchLike {
  return vi.fn(async () => new Response(body, init))
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("downloadTranscript", () => {
  it("downloads and parses a transcript", async () => {
    const fetchImpl = fakeFetch(VTT, { status: 200 })

    const result = await downloadTranscript(URL, "vtt", fetchImpl)

    expect(result).toEqual({
      fullText: "Hello there. Welcome back.",
      segments: [
        { start: 0, end: 2, text: "Hello there." },
        { start: 2, end: 4, text: "Welcome back." },
      ],
    })
    expect(fetchImpl).toHaveBeenCalledWith(URL, { signal: expect.any(AbortSignal) })
  })

  it("never fetches a private or invalid address", async () => {
    const fetchImpl = fakeFetch(VTT)

    expect(await downloadTranscript("http://127.0.0.1/ep1.vtt", "vtt", fetchImpl)).toBeNull()
    expect(await downloadTranscript("not a url", "vtt", fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("returns null for an error status", async () => {
    expect(await downloadTranscript(URL, "vtt", fakeFetch("Not found", { status: 404 }))).toBeNull()
  })

  it("returns null when the declared size is too large", async () => {
    const fetchImpl = fakeFetch(VTT, { headers: { "content-length": String(MAX_TRANSCRIPT_BYTES + 1) } })
    expect(await downloadTranscript(URL, "vtt", fetchImpl)).toBeNull()
  })

  it("returns null when the body is too large even without a declared size", async () => {
    /// A valid file, so only the size check can reject it
    const huge = VTT + "\n" + "x".repeat(MAX_TRANSCRIPT_BYTES)
    expect(await downloadTranscript(URL, "vtt", fakeFetch(huge))).toBeNull()
  })

  it("returns null when the file has no usable cues", async () => {
    expect(await downloadTranscript(URL, "vtt", fakeFetch("<html>Transcript coming soon</html>"))).toBeNull()
  })

  it("returns null instead of throwing when the download fails", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error("timed out")
    })
    expect(await downloadTranscript(URL, "vtt", fetchImpl)).toBeNull()
  })
})