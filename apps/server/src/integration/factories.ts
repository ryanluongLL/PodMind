import { pool } from "../db/index.js"
import type { ParsedPodcast } from "../scrapers/rss.js"

/// Small helpers that put known rows in the test database, so each test
/// says only what matters to it.

export function fakeFeed(overrides: Partial<ParsedPodcast> = {}): ParsedPodcast {
  return {
    name: "Slow English Stories",
    iconUrl: "https://example.com/art.jpg",
    episodes: [
      {
        title: "Episode 2",
        episodeUrl: "https://example.com/ep2",
        audioUrl: "https://example.com/ep2.mp3",
        iconUrl: null,
        publishedAt: new Date("2026-11-02T00:00:00Z"),
      },
      {
        title: "Episode 1",
        episodeUrl: "https://example.com/ep1",
        audioUrl: "https://example.com/ep1.mp3",
        iconUrl: null,
        publishedAt: new Date("2026-10-26T00:00:00Z"),
      },
    ],
    ...overrides,
  }
}

export async function insertPodcast(name: string = "Test Show", rssUrl: string = `https://example.com/${name}.rss`): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO podcasts (name, rss_url) VALUES ($1, $2) RETURNING id`,
    [name, rssUrl]
  )
  return rows[0]!.id
}

export async function insertEpisode(
  podcastId: string,
  fields: { title?: string; audioUrl?: string | null; publishedAt?: string | null } = {}
): Promise<string> {
  let audioUrl: string | null = "https://example.com/audio.mp3"
  if (fields.audioUrl !== undefined) {
    audioUrl = fields.audioUrl
  }
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO episodes (podcast_id, title, episode_url, audio_url, published_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      podcastId,
      fields.title ?? "An episode",
      `https://example.com/${Math.random().toString(36).slice(2)}`,
      audioUrl,
      fields.publishedAt ?? null,
    ]
  )
  return rows[0]!.id
}

export async function insertTranscript(
  episodeId: string,
  fields: { status: string; fullText?: string; segments?: { start: number; end: number; text: string }[] }
): Promise<void> {
  await pool.query(
    `INSERT INTO transcripts (episode_id, full_text, segments, status) VALUES ($1, $2, $3, $4)`,
    [episodeId, fields.fullText ?? "", JSON.stringify(fields.segments ?? []), fields.status]
  )
}