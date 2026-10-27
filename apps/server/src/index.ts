import 'dotenv/config'  // ← replaces the dotenv import + dotenv.config() call

import express from 'express'
import cors from 'cors'
import { pool } from './db/index.js'
import podcastsRouter from './routes/podcasts.js'
import searchRouter from './routes/search.js'
import episodeRouter from './routes/episodes.js'
import discoverRouter from './routes/discover.js'
import audioRouter from './routes/audio.js'
import translateRouter from './routes/translate.js'
import './jobs/worker.js'


const app = express()
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://pod-mind-web.vercel.app',
    process.env.FRONTEND_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json())


///public route - no auth needed
app.get('/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.json({status: 'ok', time: result.rows[0]})
})

// No login: the podcast library and transcripts are shared by all visitors.
// Personal data (vocabulary, reviews, favorites, streak) lives in the browser.
app.use('/podcasts', podcastsRouter)
app.use('/episodes', episodeRouter)
app.use('/search', searchRouter)
app.use('/discover', discoverRouter)
app.use('/audio', audioRouter)
app.use('/translate', translateRouter)

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`)
})