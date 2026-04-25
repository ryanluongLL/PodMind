import { Router } from 'express'
import { pool } from '../db/index.js'
import { enqueueTranscription } from '../jobs/queue.js'

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

export default router