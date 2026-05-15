import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router()

// GET /vocabulary/due
// Returns only words due for review today — what the review page shows.
router.get('/due', async (req, res) => {
  const userId = req.userId!
  const today = new Date().toISOString().split('T')[0]

  const { rows } = await pool.query(
    `SELECT * FROM vocabulary
     WHERE user_id = $1 AND next_review_date <= $2
     ORDER BY next_review_date ASC`,
    [userId, today]
  )
  res.json(rows)
})

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

// POST /vocabulary/:id/review
// Updates the SRS fields based on the user's self-rating (1-4).
// Implements the SM-2 algorithm:
//   1 = Again (failed), 2 = Hard, 3 = Good, 4 = Easy
router.post('/:id/review', async (req, res) => {
    const { id } = req.params
    const userId = req.userId!
    const { rating } = req.body as { rating: 1 | 2 | 3 | 4 }
    
    const { rows } = await pool.query(
        `SELECT * FROM vocabulary WHERE id = $1 AND user_id = $2`,
        [id,userId]
    )
    const word = rows[0]
    if (!word) {
        res.status(404).json({ error: 'Word not found' })
        return
    }
    let { ease_factor, interval_days } = word
    
    ///SM-2 algorithm
    if (rating === 1) {
        // Failed — reset to beginning
        interval_days = 1
    } else if (rating === 2) {
        // Hard — small increment
        interval_days = Math.ceil(interval_days * 1.2)
    } else if (rating === 3) {
        // Good — standard progression
        interval_days = Math.ceil(interval_days * ease_factor)
    } else {
        // Easy — faster progression
        interval_days = Math.ceil(interval_days * ease_factor * 1.3)
    }

    ///update ease factor based on rating (SM-2 formula)
    ease_factor = Math.max(1.3, ease_factor + 0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02))
    
    ///calculate next review date
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval_days)

    const { rows: updated } = await pool.query(
        `UPDATE vocabulary
        SET ease_factor = $1,
            interval_days = $2,
            next_review_date = $3,
            review_count = review_count + 1
        WHERE id = $4 AND user_id = $5
        RETURNING *`,
        [ease_factor, interval_days, nextReview.toISOString().split('T')[0], id, userId]
    )
    res.json(updated[0])
})


export default router