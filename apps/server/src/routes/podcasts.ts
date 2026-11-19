import { Router } from "express"
import { pool } from "../db/index.js"
import { scrapeRSS } from "../scrapers/rss.js"
import { isUuid } from "../utils/ids.js"

const router = Router()

/// Podbean show pages are web pages, not feeds. Reading them took a full
/// headless browser, so they are turned away with a pointer to the feed,
/// which every Podbean show also publishes.
const PODBEAN_PAGE_PREFIX = "https://www.podbean.com/podcast-detail/"
const PODBEAN_PAGE_MESSAGE = "Podbean pages are not supported. Search for the podcast, or paste its RSS feed URL."

/// POST /podcasts
/// Scrapes a feed and adds the podcast to the shared library. Adding a
/// podcast that already exists just refreshes its name and artwork, and any
/// new episodes get inserted.
router.post("/", async (req, res) => {
  const { url, iconUrl } = req.body as { url?: string; iconUrl?: string }

  if (!url) {
    res.status(400).json({ error: "URL is required" })
    return
  }

  if (url.startsWith(PODBEAN_PAGE_PREFIX)) {
    res.status(400).json({ error: PODBEAN_PAGE_MESSAGE })
    return
  }

  if (!url.startsWith("http")) {
    res.status(400).json({ error: "Invalid URL" })
    return
  }

  try {
    const parsed = await scrapeRSS(url)
    const finalIconUrl = iconUrl ?? parsed.iconUrl

    /// user_id is left to its default value, so the existing
    /// (rss_url, user_id) unique constraint acts as unique on rss_url alone.
    const { rows } = await pool.query(
      `INSERT INTO podcasts (name, rss_url, icon_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (rss_url, user_id) DO UPDATE
       SET name = EXCLUDED.name, icon_url = EXCLUDED.icon_url
       RETURNING *`,
      [parsed.name, url, finalIconUrl]
    )

    const podcast = rows[0]
    for (const ep of parsed.episodes) {
      /// Episodes saved before guids existed (migration 006) have no guid.
      /// Hand this guid to the matching old row first, so refreshing a feed
      /// updates that row instead of adding a copy of it.
      await pool.query(
        `UPDATE episodes SET guid = $3
         WHERE id = (
           SELECT id FROM episodes
           WHERE podcast_id = $1 AND guid IS NULL AND episode_url = $2
           LIMIT 1
         )
         AND NOT EXISTS (SELECT 1 FROM episodes WHERE podcast_id = $1 AND guid = $3)`,
        [podcast.id, ep.episodeUrl, ep.guid]
      )

      /// An episode that is already saved keeps everything except its
      /// transcript link, which publishers often add after the episode airs.
      await pool.query(
        `INSERT INTO episodes
           (podcast_id, guid, title, episode_url, audio_url, icon_url, published_at, transcript_url, transcript_format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (podcast_id, guid) DO UPDATE
         SET transcript_url = EXCLUDED.transcript_url,
             transcript_format = EXCLUDED.transcript_format`,
        [
          podcast.id,
          ep.guid,
          ep.title,
          ep.episodeUrl,
          ep.audioUrl,
          ep.iconUrl,
          ep.publishedAt,
          ep.transcript?.url ?? null,
          ep.transcript?.format ?? null,
        ]
      )
    }

    res.json({ podcast, episodeCount: parsed.episodes.length })
  } catch (err) {
    console.error("[podcasts] could not add podcast", err)
    res.status(500).json({ error: "Failed to scrape podcast" })
  }
})

/// GET /podcasts
/// Every podcast in the shared library, newest first.
router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, COUNT(e.id)::int AS episode_count
     FROM podcasts p
     LEFT JOIN episodes e ON e.podcast_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  )
  res.json(rows)
})

/// GET /podcasts/:id
/// One podcast with its episodes and their transcript status.
/// Favorites are stored in the browser, so episodes are just sorted by date.
router.get("/:id", async (req, res) => {
  const { id } = req.params

  if (!isUuid(id)) {
    res.status(404).json({ error: "Podcast not found" })
    return
  }

  const podcastRes = await pool.query(`SELECT * FROM podcasts WHERE id = $1`, [id])
  if (podcastRes.rows.length === 0) {
    res.status(404).json({ error: "Podcast not found" })
    return
  }

  const episodesRes = await pool.query(
    `SELECT e.*,
            t.status AS transcript_status,
            t.segments AS transcript_segments,
            t.progress AS transcript_progress
     FROM episodes e
     LEFT JOIN transcripts t ON t.episode_id = e.id
     WHERE e.podcast_id = $1
     ORDER BY e.published_at DESC NULLS LAST`,
    [id]
  )

  res.json({ podcast: podcastRes.rows[0], episodes: episodesRes.rows })
})

export default router