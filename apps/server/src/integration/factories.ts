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

/// A tiny dictionary, enough for Lesk to choose between meanings
export async function insertSense(
  lemma: string,
  pos: string,
  senseRank: number,
  definition: string,
  examples: string[] = []
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO dictionary_senses (lemma, pos, sense_rank, definition, examples)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [lemma, pos, senseRank, definition, examples]
  )
  return rows[0]!.id
}

/// The real list stores how often each word appeared in the subtitles.
/// Routes only read rank, so any count works here; this one shrinks with
/// rank roughly the way real word counts do (Zipf's law).
function countForRank(rank: number): number {
  return Math.max(1, Math.round(10_000_000 / rank))
}

export async function insertFrequencies(ranks: Record<string, number>): Promise<void> {
  for (const [word, rank] of Object.entries(ranks)) {
    await pool.query(
      `INSERT INTO word_frequency (word, rank, count) VALUES ($1, $2, $3)`,
      [word, rank, countForRank(rank)]
    )
  }
}

export const EMBEDDING_SIZE = 1536

/// A vector pointing along one axis. Two of these are identical (similarity
/// 1) or completely unrelated (similarity 0), which keeps search results
/// easy to predict.
export function axisVector(axis: number): number[] {
  const vector = new Array<number>(EMBEDDING_SIZE).fill(0)
  vector[axis] = 1
  return vector
}

export async function insertEmbedding(
  episodeId: string,
  chunkIndex: number,
  chunkText: string,
  vector: number[]
): Promise<void> {
  await pool.query(
    `INSERT INTO embeddings (episode_id, chunk_index, chunk_text, embedding)
     VALUES ($1, $2, $3, $4::vector)`,
    [episodeId, chunkIndex, chunkText, JSON.stringify(vector)]
  )
}