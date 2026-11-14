import { describe, it, expect } from "vitest"
import {
  detectFormat,
  formatFromType,
  mergeSegments,
  parseTimestamp,
  parseTranscript,
  pickTranscript,
} from "./feedTranscript.js"

describe("parseTimestamp", () => {
  it("reads hours, minutes, seconds, and milliseconds", () => {
    expect(parseTimestamp("01:02:03.500")).toBe(3723.5)
  })

  it("reads the short VTT form without hours", () => {
    expect(parseTimestamp("02:03.250")).toBe(123.25)
  })

  it("reads the SRT comma separator", () => {
    expect(parseTimestamp("00:00:04,000")).toBe(4)
  })

  it("pads short fractions as milliseconds", () => {
    expect(parseTimestamp("00:01.5")).toBe(1.5)
  })

  it("returns null for anything else", () => {
    expect(parseTimestamp("soon")).toBeNull()
    expect(parseTimestamp("")).toBeNull()
  })
})

describe("formatFromType", () => {
  it("maps known content types", () => {
    expect(formatFromType("text/vtt")).toBe("vtt")
    expect(formatFromType("application/x-subrip")).toBe("srt")
    expect(formatFromType("application/srt")).toBe("srt")
    expect(formatFromType("application/json")).toBe("json")
  })

  it("ignores case and parameters", () => {
    expect(formatFromType("Text/VTT; charset=utf-8")).toBe("vtt")
  })

  it("returns null for untimed or missing types", () => {
    expect(formatFromType("text/html")).toBeNull()
    expect(formatFromType("text/plain")).toBeNull()
    expect(formatFromType(undefined)).toBeNull()
  })
})

describe("pickTranscript", () => {
  it("prefers VTT over SRT and JSON", () => {
    const picked = pickTranscript([
      { url: "https://example.com/t.json", type: "application/json" },
      { url: "https://example.com/t.srt", type: "application/x-subrip" },
      { url: "https://example.com/t.vtt", type: "text/vtt" },
    ])
    expect(picked).toEqual({ url: "https://example.com/t.vtt", format: "vtt" })
  })

  it("skips transcripts in other languages", () => {
    const picked = pickTranscript([
      { url: "https://example.com/es.vtt", type: "text/vtt", language: "es" },
      { url: "https://example.com/en.srt", type: "application/srt", language: "en-US" },
    ])
    expect(picked).toEqual({ url: "https://example.com/en.srt", format: "srt" })
  })

  it("skips untimed formats and links that are not http", () => {
    const picked = pickTranscript([
      { url: "https://example.com/t.html", type: "text/html" },
      { url: "ftp://example.com/t.vtt", type: "text/vtt" },
      { url: "", type: "text/vtt" },
    ])
    expect(picked).toBeNull()
  })

  it("returns null for an item with no transcripts", () => {
    expect(pickTranscript([])).toBeNull()
  })
})

describe("detectFormat", () => {
  it("trusts the file over a wrong content type", () => {
    expect(detectFormat("WEBVTT\n\n00:00.000 --> 00:01.000\nHi", "srt")).toBe("vtt")
    expect(detectFormat('{"segments": []}', "vtt")).toBe("json")
    expect(detectFormat("1\n00:00:00,000 --> 00:00:01,000\nHi", null)).toBe("srt")
  })

  it("falls back to the declared format", () => {
    expect(detectFormat("nothing recognizable", "json")).toBe("json")
    expect(detectFormat("nothing recognizable", null)).toBeNull()
  })
})

describe("mergeSegments", () => {
  it("joins cues until a sentence ends", () => {
    const merged = mergeSegments([
      { start: 0, end: 1, text: "Welcome" },
      { start: 1, end: 2, text: "to the show." },
      { start: 2, end: 3, text: "Today we talk." },
    ])
    expect(merged).toEqual([
      { start: 0, end: 2, text: "Welcome to the show." },
      { start: 2, end: 3, text: "Today we talk." },
    ])
  })

  it("starts a new line once the join would be too long", () => {
    const merged = mergeSegments(
      [
        { start: 0, end: 5, text: "one" },
        { start: 5, end: 10, text: "two" },
        { start: 10, end: 15, text: "three" },
      ],
      12
    )
    expect(merged).toEqual([
      { start: 0, end: 10, text: "one two" },
      { start: 10, end: 15, text: "three" },
    ])
  })

  it("treats a closing quote after the period as a sentence end", () => {
    const merged = mergeSegments([
      { start: 0, end: 1, text: 'She said "hi."' },
      { start: 1, end: 2, text: "Then left." },
    ])
    expect(merged).toHaveLength(2)
  })

  it("returns an empty list for no cues", () => {
    expect(mergeSegments([])).toEqual([])
  })
})

describe("parseTranscript", () => {
  it("parses VTT with ids, voice tags, cue settings, and notes", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE produced by the host",
      "",
      "intro",
      "00:00:00.000 --> 00:00:02.500 align:start",
      "<v Host>Hello &amp; welcome.</v>",
      "",
      "00:02.500 --> 00:05.000",
      "<c.yellow>Let's</c> begin",
      "today.",
    ].join("\n")

    expect(parseTranscript(vtt, "vtt")).toEqual({
      fullText: "Hello & welcome. Let's begin today.",
      segments: [
        { start: 0, end: 2.5, text: "Hello & welcome." },
        { start: 2.5, end: 5, text: "Let's begin today." },
      ],
    })
  })

  it("parses SRT with Windows line endings", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nFirst line.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,500\r\nSecond line.\r\n"
    expect(parseTranscript(srt, "srt")?.segments).toEqual([
      { start: 1, end: 3, text: "First line." },
      { start: 3, end: 4.5, text: "Second line." },
    ])
  })

  it("parses the Podcasting 2.0 JSON format and merges word level cues", () => {
    const json = JSON.stringify({
      version: "1.0.0",
      segments: [
        { speaker: "Host", startTime: 0, endTime: 0.4, body: "Good" },
        { speaker: "Host", startTime: 0.4, endTime: 0.9, body: "morning." },
        { speaker: "Host", startTime: 1, endTime: 1.3, body: "Ready?" },
        { startTime: "bad", endTime: 2, body: "skipped" },
      ],
    })
    expect(parseTranscript(json, "json")).toEqual({
      fullText: "Good morning. Ready?",
      segments: [
        { start: 0, end: 0.9, text: "Good morning." },
        { start: 1, end: 1.3, text: "Ready?" },
      ],
    })
  })

  it("sorts cues that arrive out of order", () => {
    const srt = "2\n00:00:05,000 --> 00:00:06,000\nLater.\n\n1\n00:00:01,000 --> 00:00:02,000\nEarlier."
    expect(parseTranscript(srt, "srt")?.fullText).toBe("Earlier. Later.")
  })

  it("skips cues with broken times or no text", () => {
    const vtt = "WEBVTT\n\nxx --> 00:01.000\nBroken.\n\n00:01.000 --> 00:02.000\n<b></b>\n\n00:02.000 --> 00:03.000\nKept."
    expect(parseTranscript(vtt, "vtt")?.segments).toEqual([{ start: 2, end: 3, text: "Kept." }])
  })

  it("returns null when nothing usable comes out", () => {
    expect(parseTranscript("WEBVTT\n\n", "vtt")).toBeNull()
    expect(parseTranscript("{ not json", "json")).toBeNull()
    expect(parseTranscript('{"segments": "nope"}', "json")).toBeNull()
    expect(parseTranscript("null", "json")).toBeNull()
    expect(parseTranscript("plain words", null)).toBeNull()
  })
})