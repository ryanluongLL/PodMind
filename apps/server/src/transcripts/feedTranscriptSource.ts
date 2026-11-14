import { pool } from "../db/index.js"
import { downloadTranscript, type FetchLike } from "./downloadTranscript.js"
import type { Segment, TranscriptFormat } from "./feedTranscript.js"

/// Looks up the transcript link saved for an episode and downloads it.
/// Returns null when the episode has no link or the file is not usable,
/// which means the worker has to pay for transcription.
export async function feedTranscriptFor(
  episodeId: string,
  fetchImpl: FetchLike = fetch
): Promise<{ fullText: string; segments: Segment[] } | null> {
  const { rows } = await pool.query<{
    transcript_url: string | null
    transcript_format: TranscriptFormat | null
  }>(`SELECT transcript_url, transcript_format FROM episodes WHERE id = $1`, [episodeId])

  const episode = rows[0]
  if (!episode?.transcript_url) {
    return null
  }
  return downloadTranscript(episode.transcript_url, episode.transcript_format, fetchImpl)
}