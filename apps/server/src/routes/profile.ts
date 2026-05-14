import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router()

// GET /profile
// Returns the current user's profile, creating one with defaults if it doesn't exist.
// This auto-creation pattern means the frontend never gets a 404 — first-time users
// just get a profile with onboarded=false, which triggers the onboarding modal.
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

    ///first time user - create a default profile
    const { rows } = await pool.query(
        `INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *`,
        [userId]
    )
    res.json(rows[0])
})

// PATCH /profile
// Update any subset of profile fields. Builds the SQL dynamically so callers
// can send just the fields they want to change (same pattern as PATCH /episodes/:id).
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

export default router