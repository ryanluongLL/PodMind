import { Router } from "express"
import { pool } from "../db/index.js"
import { embedQuery } from "../services/embeddings.js"

const router = Router()

/// Every character of the query is sent to OpenAI, so keep it to a sentence
const MAX_QUERY_LENGTH = 200
const RESULT_LIMIT = 10

/// GET /search?q=...
/// Semantic search across every transcript in the shared library.
router.get("/", async (req, res) => {
  const raw = req.query.q

  /// "?q=a&q=b" arrives as an array, which would otherwise reach OpenAI
  if (typeof raw !== "string" || raw.trim().length === 0) {
    res.status(400).json({ error: "Query parameter q is required" })
    return
  }
  const query = raw.trim()
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query must be at most ${MAX_QUERY_LENGTH} characters` })
    return
  }

  try {
    const queryVector = await embedQuery(query)

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
       ORDER BY e.embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryVector), RESULT_LIMIT]
    )

    res.json({ query, results: rows })
  } catch (err) {
    console.error("[search] failed", err)
    res.status(500).json({ error: "Search failed" })
  }
})

export default router