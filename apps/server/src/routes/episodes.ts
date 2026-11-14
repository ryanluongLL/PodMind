import { Router } from "express"
import { pool } from "../db/index.js"
import { enqueueTranscription } from "../jobs/queue.js"
import { estimateDifficulty, wordsPerMinute, type TimedSegment } from "../utils/readability.js"
import { isUuid } from "../utils/ids.js"
import { DAILY_LIMIT_MESSAGE, remainingSeconds } from "../services/transcriptionBudget.js"

const router = Router()

/// POST /episodes/:id/transcribe
/// Creates a pending transcript row and enqueues the transcription job.
/// If the episode is already transcribed or in progress, nothing is enqueued,
/// so two visitors clicking at once never pay for the same transcription twice.
/// A failed transcript can be requested again.
router.post("/:id/transcribe", async (req, res) => {
  const { id } = req.params

  if (!isUuid(id)) {
    res.status(404).json({ error: "Episode not found or has no audio" })
    return
  }

  const { rows } = await pool.query<{
    id: string
    audio_url: string
    transcript_url: string | null
    transcript_status: string | null
  }>(
    `SELECT e.id, e.audio_url, e.transcript_url, t.status AS transcript_status
     FROM episodes e
     LEFT JOIN transcripts t ON t.episode_id = e.id
     WHERE e.id = $1 AND e.audio_url IS NOT NULL`,
    [id]
  )
  const episode = rows[0]
  if (!episode) {
    res.status(404).json({ error: "Episode not found or has no audio" })
    return
  }

  if (episode.transcript_status !== null && episode.transcript_status !== "failed") {
    res.json({ message: "Already transcribed or in progress", episodeId: episode.id })
    return
  }

  /// Episodes with a free feed transcript never touch the paid budget
  if (episode.transcript_url === null && (await remainingSeconds()) <= 0) {
    res.status(429).json({ error: DAILY_LIMIT_MESSAGE })
    return
  }

  /// Only a new row or a failed one becomes pending. If another request got
  /// here first, the row is already pending and nothing comes back.
  const inserted = await pool.query(
    `INSERT INTO transcripts (episode_id, full_text, status)
     VALUES ($1, '', 'pending')
     ON CONFLICT (episode_id) DO UPDATE
     SET status = 'pending', progress = 0
     WHERE transcripts.status = 'failed'
     RETURNING id`,
    [episode.id]
  )

  if (inserted.rows.length === 0) {
    res.json({ message: "Already transcribed or in progress", episodeId: episode.id })
    return
  }

  await enqueueTranscription(episode.id, episode.audio_url)
  res.json({ message: "Transcription job enqueued", episodeId: episode.id })
})

/// POST /episodes/:id/rate-difficulty
/// Computes CEFR difficulty locally with Flesch Kincaid readability
/// plus speaking speed. No API call.
router.post("/:id/rate-difficulty", async (req, res) => {
  const { id } = req.params

  if (!isUuid(id)) {
    res.status(404).json({ error: "Transcript not found or not ready" })
    return
  }

  const { rows } = await pool.query<{ full_text: string; segments: TimedSegment[] | null }>(
    `SELECT t.full_text, t.segments
     FROM transcripts t
     WHERE t.episode_id = $1 AND t.status = 'done'`,
    [id]
  )

  const transcript = rows[0]
  if (!transcript) {
    res.status(404).json({ error: "Transcript not found or not ready" })
    return
  }

  const speed = wordsPerMinute(transcript.full_text, transcript.segments)
  const result = estimateDifficulty(transcript.full_text, speed)

  await pool.query(
    `UPDATE episodes SET difficulty = $1, words_per_minute = $2 WHERE id = $3`,
    [result.level, speed, id]
  )

  res.json({ level: result.level, wordsPerMinute: speed, reason: result.reason })
})

export default router