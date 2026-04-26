import { enqueueTranscription } from '../jobs/queue.js'
import { Router } from 'express'
import { pool } from '../db/index.js'
import { scrapeRSS } from '../scrapers/rss.js'  // ← was scrapeRRS
import { scrapePodbean } from '../scrapers/podbean.js'

const router = Router()

///POST /podcast - scrape and save a new podcast, scoped to the current uesr
router.post('/', async (req, res) => {
    const { url } = req.body as { url: string }
    const userId = req.userId!

    if (!url) {
        res.status(400).json({ error: 'URL is required' })
        return
    }

    const isPodBean = url.startsWith('https://www.podbean.com/podcast-detail/')
    const isRSS = url.startsWith('http')

    if (!isPodBean && !isRSS) {
        res.status(400).json({ error: "Invalid URL" })
        return
    }

    try {
        let parsed;
        if (isPodBean) {
            parsed = await scrapePodbean(url);
        } else {
            parsed = await scrapeRSS(url);
        }

        const { rows } = await pool.query(
            `INSERT INTO podcasts (name, podbean_url, rss_url, icon_url, user_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (rss_url) DO UPDATE SET name = EXCLUDED.name
            RETURNING *`,
            [
                parsed.name,
                isPodBean ? url : null,
                isPodBean ? null : url,
                parsed.iconUrl,
                userId,
            ]
        )

        const podcast = rows[0]
        for (const ep of parsed.episodes) {
            await pool.query(
                `INSERT INTO episodes (podcast_id, title, episode_url, audio_url, icon_url, published_at, user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (episode_url) DO NOTHING`,
                [podcast.id, ep.title, ep.episodeUrl, ep.audioUrl, ep.iconUrl, ep.publishedAt, userId]
            )
        }
        res.json({podcast, episodeCount: parsed.episodes.length})
    } catch (err) {
        console.error(err)
        res.status(500).json({error: "Failed to scrape podcast"})
    }
})


///GET /podcast only return podcasts belonging to the current user
router.get('/', async (req, res) => {
    const userId = req.userId!
    const { rows } = await pool.query(
        `SELECT p.*, COUNT(e.id)::int AS episode_count
        FROM podcasts p
        LEFT JOIN episodes e ON e.podcast_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
        [userId]
    )
    res.json(rows)
})


// GET /podcasts/:id — verify ownership before returning
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!

  const podcastRes = await pool.query(
    `SELECT * FROM podcasts WHERE id = $1 AND user_id = $2`,
    [id, userId]
  )
  if (podcastRes.rows.length === 0) {
    res.status(404).json({ error: 'Podcast not found' })
    return
  }

  const episodesRes = await pool.query(
        `SELECT e.*, t.status AS transcript_status, t.segments AS transcript_segments
        FROM episodes e
        LEFT JOIN transcripts t ON t.episode_id = e.id
        WHERE e.podcast_id = $1 AND e.user_id = $2
        ORDER BY e.is_favorite DESC, e.published_at DESC`,
      [id, userId]
  )

  res.json({ podcast: podcastRes.rows[0], episodes: episodesRes.rows })
})

// POST /podcasts/:id/transcribe — enqueue transcription for one episode
router.post('/:id/transcribe', async (req, res) => {
  const { id } = req.params
  const userId = req.userId!

  const { rows } = await pool.query(
    `SELECT e.id, e.audio_url FROM episodes e
     WHERE e.podcast_id = $1 AND e.user_id = $2 AND e.audio_url IS NOT NULL
     LIMIT 1`,
    [id, userId]
  )
  const episode = rows[0]
  if (!episode) {
    res.status(404).json({ error: 'No episodes with audio found' })
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