import { Router } from 'express'
import { pool } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const userId = req.userId!
  const existing = await pool.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  )
  if (existing.rows.length > 0) {
    res.json(existing.rows[0])
    return
  }
  const { rows } = await pool.query(
    `INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *`,
    [userId]
  )
  res.json(rows[0])
})

router.patch('/', async (req, res) => {
  const userId = req.userId!
  const { native_language, english_level, daily_goal_minutes, onboarded } = req.body as {
    native_language?: string
    english_level?: string
    daily_goal_minutes?: number
    onboarded?: boolean
  }

  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  if (native_language !== undefined) { updates.push(`native_language = $${i++}`); values.push(native_language) }
  if (english_level !== undefined) { updates.push(`english_level = $${i++}`); values.push(english_level) }
  if (daily_goal_minutes !== undefined) { updates.push(`daily_goal_minutes = $${i++}`); values.push(daily_goal_minutes) }
  if (onboarded !== undefined) { updates.push(`onboarded = $${i++}`); values.push(onboarded) }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  values.push(userId)
  const { rows } = await pool.query(
    `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING *`,
    values
  )
  res.json(rows[0])
})

// POST /profile/listen — logs listening activity and updates streak
router.post('/listen', async (req, res) => {
  const userId = req.userId!
  const { minutes } = req.body as { minutes: number }

  const today = new Date().toISOString().split('T')[0]

  const { rows } = await pool.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  )
  const profile = rows[0]
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const lastActive = profile.last_active_date
    ? new Date(profile.last_active_date).toISOString().split('T')[0]
    : null

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Calculate streak: increment if active yesterday, reset if missed a day
  let newStreak = profile.current_streak
  if (lastActive === today) {
    // Already logged today — no streak change
  } else if (lastActive === yesterdayStr) {
    newStreak += 1
  } else {
    newStreak = 1
  }

  const { rows: updated } = await pool.query(
    `UPDATE user_profiles
     SET current_streak = $1, last_active_date = $2
     WHERE user_id = $3
     RETURNING *`,
    [newStreak, today, userId]
  )

  res.json(updated[0])
})

// GET /profile/stats — returns stats for the dashboard
router.get('/stats', async (req, res) => {
  const userId = req.userId!
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [profileRes, vocabRes, dueRes, transcriptRes] = await Promise.all([
    pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT COUNT(*) FROM vocabulary WHERE user_id = $1 AND created_at >= $2`,
      [userId, weekAgo.toISOString()]
    ),
    pool.query(
      `SELECT COUNT(*) FROM vocabulary WHERE user_id = $1 AND next_review_date <= $2`,
      [userId, today]
    ),
    pool.query(
      `SELECT COUNT(*) FROM transcripts t
       JOIN episodes e ON e.id = t.episode_id
       WHERE e.user_id = $1 AND t.status = 'done'`,
      [userId]
    ),
  ])

  res.json({
    streak: profileRes.rows[0]?.current_streak ?? 0,
    dailyGoal: profileRes.rows[0]?.daily_goal_minutes ?? 15,
    englishLevel: profileRes.rows[0]?.english_level ?? 'B1',
    wordsThisWeek: parseInt(vocabRes.rows[0]?.count ?? '0'),
    wordsDueForReview: parseInt(dueRes.rows[0]?.count ?? '0'),
    episodesTranscribed: parseInt(transcriptRes.rows[0]?.count ?? '0'),
  })
})

export default router