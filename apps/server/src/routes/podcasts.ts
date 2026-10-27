import { Router } from 'express'
import { pool } from '../db/index.js'
import { scrapeRSS } from '../scrapers/rss.js'
import { scrapePodbean } from '../scrapers/podbean.js'

const router = Router()

// POST /podcasts
// Scrapes a feed and adds the podcast to the shared library. Adding a
// podcast that already exists just refreshes its name and artwork, and any
// new episodes get inserted.
router.post('/', async (req, res) => {
  const { url, iconUrl } = req.body as { url?: string; iconUrl?: string }

  if (!url) {
    res.status(400).json({ error: 'URL is required' })
    return
  }

  const isPodbean = url.startsWith('https://www.podbean.com/podcast-detail/')
  const isRSS = url.startsWith('http')

  if (!isPodbean && !isRSS) {
    res.status(400).json({ error: 'Invalid URL' })
    return
  }

  try {
    let parsed
    if (isPodbean) {
      parsed = await scrapePodbean(url)
    } else {
      parsed = await scrapeRSS(url)
    }

    const finalIconUrl = iconUrl ?? parsed.iconUrl

    // user_id is left to its default value, so the existing
    // (rss_url, user_id) unique constraint acts as unique on rss_url alone.
    const { rows } = await pool.query(
      `INSERT INTO podcasts (name, podbean_url, rss_url, icon_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rss_url, user_id) DO UPDATE
       SET name = EXCLUDED.name, icon_url = EXCLUDED.icon_url
       RETURNING *`,
      [
        parsed.name,
        isPodbean ? url : null,
        isPodbean ? null : url,
        finalIconUrl,
      ]
    )

    const podcast = rows[0]
    for (const ep of parsed.episodes) {
      await pool.query(
        `INSERT INTO episodes (podcast_id, title, episode_url, audio_url, icon_url, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [podcast.id, ep.title, ep.episodeUrl, ep.audioUrl, ep.iconUrl, ep.publishedAt]
      )
    }

    res.json({ podcast, episodeCount: parsed.episodes.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to scrape podcast' })
  }
})

// GET /podcasts
// Every podcast in the shared library, newest first.
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, COUNT(e.id)::int AS episode_count
     FROM podcasts p
     LEFT JOIN episodes e ON e.podcast_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  )
  res.json(rows)
})

// GET /podcasts/:id
// One podcast with its episodes and their transcript status.
// Favorites are stored in the browser, so episodes are just sorted by date.
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const podcastRes = await pool.query(`SELECT * FROM podcasts WHERE id = $1`, [id])
  if (podcastRes.rows.length === 0) {
    res.status(404).json({ error: 'Podcast not found' })
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