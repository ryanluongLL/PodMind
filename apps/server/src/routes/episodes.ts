import { Router } from 'express'
import { pool } from '../db/index.js'
import { enqueueTranscription } from '../jobs/queue.js'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

// PATCH /episodes/:id — partial update, verify ownership first
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

  if (is_favorite !== undefined) { updates.push(`is_favorite = $${i++}`); values.push(is_favorite) }
  if (rating !== undefined) { updates.push(`rating = $${i++}`); values.push(rating) }
  if (hashtags !== undefined) { updates.push(`hashtags = $${i++}`); values.push(hashtags) }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  // user_id check ensures users can only update their own episodes
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

router.post('/:id/rate-difficulty', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!

  ///get the transcript for this viceo
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

  ///calculate words per minute from segments
  const segments = episode.segments as { start: number; end: number; text: string }[]
  let wordsPerMinute = 0
  if (segments && segments.length > 0) {
    const totalWords = episode.full_text.split(' ').length
    const lastSegment = segments[segments.length - 1]
    const durationMinutes = (lastSegment?.end ?? 0) / 60
    wordsPerMinute = durationMinutes > 0 ? Math.round(totalWords / durationMinutes) : 0
  }

  ///sample the transcript - use first 2000 chars to save tokens
  const sample = episode.full_text.slice(0, 2000)
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Rate the English difficulty of this podcast transcript excerpt for language learners.

Speaking speed: ${wordsPerMinute} words per minute

Transcript:
"${sample}"

Respond with ONLY a JSON object like this:
{"level": "B1", "reason": "one sentence explanation"}

Use CEFR levels: A1, A2, B1, B2, C1, C2.
Consider vocabulary complexity, sentence structure, speaking speed, and idioms.`
    }]
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  const level = parsed.level as string

  ///save to the episodes table
  await pool.query(
    `UPDATE episodes SET difficulty = $1, words_per_minute = $2 WHERE id = $3 AND user_id = $4`,
    [level, wordsPerMinute, id, userId]
  )

  res.json({level, wordsPerMinute, reason: parsed.reason})

})

export default router