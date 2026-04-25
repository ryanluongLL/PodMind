import 'dotenv/config'  // ← replaces the dotenv import + dotenv.config() call

import express from 'express'
import cors from 'cors'
import { pool } from './db/index.js'
import podcastsRouter from './routes/podcasts.js'
import searchRouter from './routes/search.js'
import episodeRouter from './routes/episodes.js'
import './jobs/worker.js'
import { clerkAuth, requireAuth } from './middleware/auth.js'

const app = express()
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

///JWT verification on every request
app.use(clerkAuth)

///public route - no auth needed
app.get('/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.json({status: 'ok', time: result.rows[0]})
})

app.use('/podcasts', requireAuth, podcastsRouter)
app.use('/search', requireAuth, searchRouter)
app.use('/episodes', requireAuth, episodeRouter)

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`)
})