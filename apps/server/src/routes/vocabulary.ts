import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router()

// POST /vocabulary
// Saves a word to the user's vocabulary deck.
// ON CONFLICT does nothing — silently ignores duplicate saves.

router.post('/', async (req, res) => {
    const userId = req.userId!
    const { word, translation, contextSentence, episodeId, timestampSeconds } = req.body as {
        word: string
        translation: string
        contextSentence: string
        episodeId: string
        timestampSeconds: number
    }

    const { rows } = await pool.query(
        `INSERT INTO vocabulary (user_id, word, translation, context_sentence, episode_id, timestamp_seconds)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, word) DO NOTHING
        RETURNING *`,
        [userId, word, translation, contextSentence, episodeId, timestampSeconds]
    )
    res.json(rows[0] ?? {message: 'Word already saved'})
})

// GET /vocabulary
// Returns all saved words for the current user, ordered by next review date
// so the review page always shows the most urgent words first.

router.get('/', async (req, res) => {
    const userId = req.userId!
    const { rows } = await pool.query(
        `SELECT * FROM vocabulary
        WHERE user_id = $1
        ORDER BY next_review_date ASC, created_at DESC`,
        [userId]
    )
    res.json(rows)
})

// DELETE /vocabulary/:id
// Removes a word from the deck entirely.
router.delete('/:id', async (req, res) => {
    const { id } = req.params
    const userId = req.userId!

    await pool.query(
        `DELETE FROM vocabulary WHERE id = $1 AND user_id = $2`,
    )
    res.json({message: 'Word removed'})
})

export default router