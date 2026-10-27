import { Router } from 'express'
import { pool } from '../db/index.js'
import { enqueueTranscription } from '../jobs/queue.js'
import { estimateDifficulty } from '../utils/readability.js'

const router = Router()

// POST /episodes/:id/transcribe
// Creates a pending transcript row and enqueues the Whisper and embedding job.
// If the episode is already transcribed or in progress, nothing is enqueued,
// so two visitors clicking at once never pay for the same transcription twice.
router.post('/:id/transcribe', async (req, res) => {
  const { id } = req.params

  const { rows } = await pool.query(
    `SELECT id, audio_url FROM episodes WHERE id = $1 AND audio_url IS NOT NULL`,
    [id]
  )
  const episode = rows[0]
  if (!episode) {
    res.status(404).json({ error: 'Episode not found or has no audio' })
    return
  }

  const inserted = await pool.query(
    `INSERT INTO transcripts (episode_id, full_text, status)
     VALUES ($1, '', 'pending')
     ON CONFLICT (episode_id) DO NOTHING
     RETURNING id`,
    [episode.id]
  )

  if (inserted.rows.length === 0) {
    res.json({ message: 'Already transcribed or in progress', episodeId: episode.id })
    return
  }

  await enqueueTranscription(episode.id, episode.audio_url)
  res.json({ message: 'Transcription job enqueued', episodeId: episode.id })
})

// POST /episodes/:id/rate-difficulty
// Computes CEFR difficulty locally with Flesch Kincaid readability
// plus speaking speed. No API call.
router.post('/:id/rate-difficulty', async (req, res) => {
  const { id } = req.params

  const { rows } = await pool.query(
    `SELECT t.full_text, t.segments
     FROM transcripts t
     WHERE t.episode_id = $1 AND t.status = 'done'`,
    [id]
  )

  const transcript = rows[0]
  if (!transcript) {
    res.status(404).json({ error: 'Transcript not found or not ready' })
    return
  }

  const segments = transcript.segments as { start: number; end: number; text: string }[]
  let wordsPerMinute = 0
  if (segments && segments.length > 0) {
    const totalWords = transcript.full_text.split(' ').length
    const lastSegment = segments[segments.length - 1]
    const durationMinutes = (lastSegment?.end ?? 0) / 60
    if (durationMinutes > 0) {
      wordsPerMinute = Math.round(totalWords / durationMinutes)
    }
  }

  const result = estimateDifficulty(transcript.full_text, wordsPerMinute)

  await pool.query(
    `UPDATE episodes SET difficulty = $1, words_per_minute = $2 WHERE id = $3`,
    [result.level, wordsPerMinute, id]
  )

  res.json({ level: result.level, wordsPerMinute, reason: result.reason })
})

export default router