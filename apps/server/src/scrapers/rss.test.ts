import { describe, it, expect } from "vitest"
import { MAX_EPISODES, parseFeed, transcriptLinks } from "./rss.js"

function feedXml(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Slow English Stories</title>
    <image><url>https://example.com/art.jpg</url></image>
    ${items}
  </channel>
</rss>`
}

describe("parseFeed", () => {
  it("reads the podcast and its episodes", async () => {
    const parsed = await parseFeed(
      feedXml(`
      <item>
        <title>Episode 1</title>
        <link>https://example.com/ep1</link>
        <pubDate>Mon, 26 Oct 2026 00:00:00 GMT</pubDate>
        <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1000"/>
        <itunes:image href="https://example.com/ep1.jpg"/>
      </item>`)
    )

    expect(parsed.name).toBe("Slow English Stories")
    expect(parsed.iconUrl).toBe("https://example.com/art.jpg")
    expect(parsed.episodes).toEqual([
      {
        title: "Episode 1",
        episodeUrl: "https://example.com/ep1",
        audioUrl: "https://example.com/ep1.mp3",
        iconUrl: "https://example.com/ep1.jpg",
        publishedAt: new Date("2026-10-26T00:00:00Z"),
        transcript: null,
      },
    ])
  })

  it("picks the best transcript the publisher links", async () => {
    const parsed = await parseFeed(
      feedXml(`
      <item>
        <title>Episode 1</title>
        <link>https://example.com/ep1</link>
        <podcast:transcript url="https://example.com/ep1.html" type="text/html"/>
        <podcast:transcript url="https://example.com/ep1.json" type="application/json"/>
        <podcast:transcript url="https://example.com/ep1.vtt" type="text/vtt" language="en"/>
      </item>`)
    )

    expect(parsed.episodes[0]?.transcript).toEqual({ url: "https://example.com/ep1.vtt", format: "vtt" })
  })

  it("leaves the transcript empty when only untimed formats are linked", async () => {
    const parsed = await parseFeed(
      feedXml(`
      <item>
        <title>Episode 1</title>
        <podcast:transcript url="https://example.com/ep1.txt" type="text/plain"/>
      </item>`)
    )

    expect(parsed.episodes[0]?.transcript).toBeNull()
  })

  it("falls back to the guid, then the audio file, for the episode key", async () => {
    const parsed = await parseFeed(
      feedXml(`
      <item>
        <title>Has guid</title>
        <link>/relative/page</link>
        <guid>episode-guid-1</guid>
      </item>
      <item>
        <title>Audio only</title>
        <enclosure url="https://example.com/ep2.mp3" type="audio/mpeg" length="1000"/>
      </item>
      <item></item>`)
    )

    expect(parsed.episodes.map((episode) => episode.episodeUrl)).toEqual([
      "episode-guid-1",
      "https://example.com/ep2.mp3",
      "",
    ])
    expect(parsed.episodes[2]).toMatchObject({ title: "Untitled", audioUrl: null, publishedAt: null })
  })

  it("names an untitled feed and keeps only the newest episodes", async () => {
    const items = Array.from({ length: MAX_EPISODES + 5 }, (_, i) => `<item><title>Episode ${i}</title></item>`)
    const parsed = await parseFeed(`<?xml version="1.0"?><rss version="2.0"><channel>${items.join("")}</channel></rss>`)

    expect(parsed.name).toBe("Unknown Podcast")
    expect(parsed.iconUrl).toBeNull()
    expect(parsed.episodes).toHaveLength(MAX_EPISODES)
  })
})

describe("transcriptLinks", () => {
  it("skips tags without a url", () => {
    expect(
      transcriptLinks({
        transcripts: [
          { $: { type: "text/vtt" } },
          {},
          { $: { url: "https://example.com/t.srt", type: "application/srt" } },
          { $: { url: "https://example.com/es.vtt", language: "es" } },
        ],
      })
    ).toEqual([
      { url: "https://example.com/t.srt", type: "application/srt" },
      { url: "https://example.com/es.vtt", language: "es" },
    ])
  })

  it("returns an empty list for an item without transcripts", () => {
    expect(transcriptLinks({})).toEqual([])
  })
})