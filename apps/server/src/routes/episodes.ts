import { Router } from "express";
import { pool } from "../db/index.js";
import { enqueueTranscription } from "../jobs/queue.js";

const router = Router()

/// PATCH /episodes/:id
/// Partial update — only the fields the client sends get updated.
/// Builds the SQL dynamically so we don't have to write separate routes
/// for favorite, rating, and hashtags.

router.patch('/:id', async (req, res) => {
    const { id } = req.params
    const { is_favorite, rating, hashtags } = req.body as {
        is_favorite?: boolean
        rating?: number
        hashtags?:string[]
    }

    ///build the SET clause dynamically so unspecified fields are left untouched
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

    if (values.length === 0) {
        res.status(400).json({ error: 'No field to update' })
        return
    }

    values.push(id)
    const { rows } = await pool.query(
        `UPDATE episodes SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values
    )

    res.json(rows[0])
    
})

/// POST /episodes/:id/transcribe
/// Kicks off the full transcription pipeline for a single episode:
/// 1. Verify the episode has an audio URL
/// 2. Create a 'pending' transcript row (or skip if one already exists)
/// 3. Enqueue the job — the worker picks it up and handles
/// download → compress → Whisper → embed → store in pgvector

router.post('/:id/transcribe', async (req, res) => {
    const { id } = req.params
    const { rows } = await pool.query(
        `SELECT id, audio_url FROM episodes WHERE id = $1 AND audio_url IS NOT NULL`,
        [id]
    )
    const episode = rows[0]
    if (!episode) {
        res.status(404).json({ error: "Episode not found or has no audio" })
        return
    }

    ///insert a pending transcript row so the UI can immediately show "processing" status
    await pool.query(
        `INSERT INTO transcripts (episode_id, full_text, status)
        VALUES ($1, '', 'pending')
        ON CONFLICT (episode_id) DO NOTHING `,
        [episode.id]
    )

    await enqueueTranscription(episode.id, episode.audio_url)
    res.json({message: "Trascription job enqueued", episodeId: episode.id})
})

export default router
