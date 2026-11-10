import express, { type NextFunction, type Request, type Response } from "express"
import cors from "cors"
import { pool } from "./db/index.js"
import podcastsRouter from "./routes/podcasts.js"
import searchRouter from "./routes/search.js"
import episodeRouter from "./routes/episodes.js"
import discoverRouter from "./routes/discover.js"
import audioRouter from "./routes/audio.js"
import translateRouter from "./routes/translate.js"

/// Builds the Express app without starting it. index.ts starts it for real,
/// and the integration tests hand it straight to Supertest, so no port is
/// opened and the transcription worker is never loaded during tests.
export const app = express()

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://pod-mind-web.vercel.app",
      process.env.FRONTEND_URL ?? "",
    ].filter(Boolean),
    credentials: true,
  })
)
app.use(express.json())

/// Public health check, also used by Render to know the server is up
app.get("/health", async (_req, res) => {
  const result = await pool.query("SELECT NOW()")
  res.json({ status: "ok", time: result.rows[0] })
})

/// No login: the podcast library and transcripts are shared by all visitors.
/// Personal data (vocabulary, reviews, favorites, streak) lives in the browser.
app.use("/podcasts", podcastsRouter)
app.use("/episodes", episodeRouter)
app.use("/search", searchRouter)
app.use("/discover", discoverRouter)
app.use("/audio", audioRouter)
app.use("/translate", translateRouter)

/// Unknown routes get JSON instead of Express's default HTML page
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" })
})

/// Last resort for errors a route did not handle. Express 5 sends errors
/// thrown in async handlers here. The client gets a plain JSON message and
/// the details only go to the server log.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] unhandled error", err)
  if (res.headersSent) {
    return
  }
  res.status(500).json({ error: "Something went wrong" })
})