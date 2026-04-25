import { Router } from 'express'
import { pool } from '../db/index.js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const router = Router()

// GET /search?q=... — semantic search scoped to the current user's transcripts
router.get('/', async (req, res) => {
  const query = req.query.q as string
  const userId = req.userId!

  if (!query) {
    res.status(400).json({ error: 'Query parameter q is required' })
    return
  }

  try {
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryVector = embeddingRes.data[0]?.embedding

    // Only search embeddings belonging to this user
    const { rows } = await pool.query(
      `SELECT
         e.episode_id,
         e.chunk_text,
         e.chunk_index,
         ep.title AS episode_title,
         p.name AS podcast_name,
         ep.icon_url,
         ep.episode_url,
         1 - (e.embedding <=> $1::vector) AS similarity
       FROM embeddings e
       JOIN episodes ep ON ep.id = e.episode_id
       JOIN podcasts p ON p.id = ep.podcast_id
       WHERE e.user_id = $2
       ORDER BY e.embedding <=> $1::vector
       LIMIT 10`,
      [JSON.stringify(queryVector), userId]
    )

    res.json({ query, results: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Search failed' })
  }
})

export default router