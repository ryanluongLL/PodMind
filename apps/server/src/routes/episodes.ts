import { Router } from 'express'
import { pool } from '../db/index.js'
import { enqueueTranscription } from '../jobs/queue.js'
import { estimateDifficulty } from '../utils/readability.js'

const router = Router()

// PATCH /episodes/:id
// Partial update. Only the fields the client sends get updated.
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!
  const { is_favorite, rating, hashtags } = req.body as {
    is_favorite?: boolean
    rating?: number
    hashtags?: string[]
  }

  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  if (is_favorite !== undefined) {
    updates.push(`is_favorite = $${i++}`)
    values.push(is_favorite)
  }
  if (rating !== undefined) {
    updates.push(`rating = $${i++}`)
    values.push(rating)
  }
  if (hashtags !== undefined) {
    updates.push(`hashtags = $${i++}`)
    values.push(hashtags)
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  values.push(id, userId)
  const { rows } = await pool.query(
    `UPDATE episodes SET ${updates.join(', ')}
     WHERE id = $${i} AND user_id = $${i + 1}
     RETURNING *`,
    values
  )

  if (rows.length === 0) {
    res.status(404).json({ error: 'Episode not found' })
    return
  }

  res.json(rows[0])
})

// POST /episodes/:id/transcribe
// Creates a pending transcript row and enqueues the Whisper + embedding job.
router.post('/:id/transcribe', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!

  const { rows } = await pool.query(
    `SELECT id, audio_url FROM episodes
     WHERE id = $1 AND user_id = $2 AND audio_url IS NOT NULL`,
    [id, userId]
  )
  const episode = rows[0]
  if (!episode) {
    res.status(404).json({ error: 'Episode not found or has no audio' })
    return
  }

  await pool.query(
    `INSERT INTO transcripts (episode_id, full_text, status, user_id)
     VALUES ($1, '', 'pending', $2)
     ON CONFLICT (episode_id) DO NOTHING`,
    [episode.id, userId]
  )

  await enqueueTranscription(episode.id, episode.audio_url, userId)
  res.json({ message: 'Transcription job enqueued', episodeId: episode.id })
})

// POST /episodes/:id/rate-difficulty
// Computes CEFR difficulty locally with Flesch-Kincaid readability
// plus speaking speed. No API call.
router.post('/:id/rate-difficulty', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!

  const { rows } = await pool.query(
    `SELECT t.full_text, t.segments, e.id
     FROM transcripts t
     JOIN episodes e ON e.id = t.episode_id
     WHERE e.id = $1 AND e.user_id = $2 AND t.status = 'done'`,
    [id, userId]
  )

  const episode = rows[0]
  if (!episode) {
    res.status(404).json({ error: 'Transcript not found or not ready' })
    return
  }

  const segments = episode.segments as { start: number; end: number; text: string }[]
  let wordsPerMinute = 0
  if (segments && segments.length > 0) {
    const totalWords = episode.full_text.split(' ').length
    const lastSegment = segments[segments.length - 1]
    const durationMinutes = (lastSegment?.end ?? 0) / 60
    if (durationMinutes > 0) {
      wordsPerMinute = Math.round(totalWords / durationMinutes)
    }
  }

  const result = estimateDifficulty(episode.full_text, wordsPerMinute)

  await pool.query(
    `UPDATE episodes SET difficulty = $1, words_per_minute = $2
     WHERE id = $3 AND user_id = $4`,
    [result.level, wordsPerMinute, id, userId]
  )

  res.json({ level: result.level, wordsPerMinute, reason: result.reason })
})

export default router