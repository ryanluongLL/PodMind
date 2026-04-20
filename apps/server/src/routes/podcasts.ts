import { enqueueTranscription } from '../jobs/queue.js'
import { Router } from 'express'
import { pool } from '../db/index.js'
import { scrapeRSS } from '../scrapers/rss.js'  // ← was scrapeRRS
import { scrapePodbean } from '../scrapers/podbean.js'

const router = Router()

router.post('/', async (req, res) => {
    const { url } = req.body as { url: string }
    
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
            `INSERT INTO podcasts (name, podbean_url, rss_url, icon_url)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (podbean_url) DO UPDATE SET name = EXCLUDED.name
            RETURNING *`,
            [
                parsed.name,
                isPodBean ? url : null,
                isPodBean ? null : url,
                parsed.iconUrl,
            ]
        )

        const podcast = rows[0]
        for (const ep of parsed.episodes) {
            await pool.query(
                `INSERT INTO episodes (podcast_id, title, episode_url, audio_url, icon_url, published_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (episode_url) DO NOTHING`,
                [podcast.id, ep.title, ep.episodeUrl, ep.audioUrl, ep.iconUrl, ep.publishedAt]
            )
        }
        res.json({podcast, episodeCount: parsed.episodes.length})
    } catch (err) {
        console.error(err)
        res.status(500).json({error: "Failed to scrape podcast"})
    }
})

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

router.post('/:id/transcribe', async (req, res) => {
    const { id } = req.params
    const { rows } = await pool.query(
        `SELECT e.id, e.audio_url FROM episodes e WHERE e.podcast_id = $1 AND e.audio_url IS NOT NULL LIMIT 1`,
        [id]
    )
    const episode = rows[0]
    if (!episode) {
        res.status(404).json({ error: 'No episodes with audio found' })
        return
    }

    await pool.query(
        `INSERT INTO transcripts (episode_id,full_text, status)
        VALUES ($1,'','pending')
        ON CONFLICT (episode_id) DO NOTHING`,
        [episode.id]
    )

    await enqueueTranscription(episode.id, episode.audio_url)
    res.json({message: 'Transcription job enqueued', episodeId: episode.id})
})

export default router