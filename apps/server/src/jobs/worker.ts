import { UnrecoverableError, Worker } from "bullmq"
import { Redis } from "ioredis"
import { pool } from "../db/index.js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
import os from "os"
import ffmpeg from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import { feedTranscriptFor } from "../transcripts/feedTranscriptSource.js"
import { providerFromEnv, transcribeFile, type ProviderName } from "../services/transcriber.js"
import { DAILY_LIMIT_MESSAGE, estimateSeconds, remainingSeconds } from "../services/transcriptionBudget.js"

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

/// Embeddings for semantic search still use OpenAI. They cost a fraction of
/// a cent per episode, unlike transcription.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const AUDIO_STORAGE_DIR = path.join(process.cwd(), "audio_cache")

if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
  fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true })
}

type TranscriptSource = "feed" | ProviderName

function compressAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("16k")
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath)
  })
}

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }
  return chunks
}

/// The player streams this compressed copy, so every episode needs it, even
/// when the transcript comes free from the feed. A retried job reuses it.
async function cacheAudio(episodeId: string, audioUrl: string): Promise<string> {
  const compressedPath = path.join(AUDIO_STORAGE_DIR, `${episodeId}.mp3`)
  if (fs.existsSync(compressedPath)) {
    return compressedPath
  }

  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error(`Audio download failed with status ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const rawPath = path.join(os.tmpdir(), `${episodeId}-raw.mp3`)
  fs.writeFileSync(rawPath, buffer)
  console.log(`[worker] audio downloaded, size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`)

  try {
    await compressAudio(rawPath, compressedPath)
  } finally {
    fs.unlinkSync(rawPath)
  }
  console.log(`[worker] compressed size: ${(fs.statSync(compressedPath).size / 1024 / 1024).toFixed(1)} MB`)
  return compressedPath
}

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

const worker = new Worker(
  "transcription",
  async (job) => {
    const { episodeId, audioUrl } = job.data as {
      episodeId: string
      audioUrl: string
    }
    console.log(`[worker] starting transcription for episode ${episodeId}`)

    await pool.query(`UPDATE transcripts SET status = 'processing' WHERE episode_id = $1`, [episodeId])

    const compressedPath = await cacheAudio(episodeId, audioUrl)

    /// If a transcript already exists (for example a retried job), keep it
    const existing = await pool.query(
      `SELECT full_text, segments FROM transcripts WHERE episode_id = $1 AND full_text != ''`,
      [episodeId]
    )

    let transcriptText: string

    if (existing.rows.length > 0 && existing.rows[0].segments) {
      console.log("[worker] transcript already exists, skipping transcription")
      transcriptText = existing.rows[0].full_text
    } else {
      /// Free first: the transcript the publisher links in its feed
      let transcript = await feedTranscriptFor(episodeId)
      let source: TranscriptSource = "feed"
      let paidSeconds: number | null = null

      /// Paid only when the feed has nothing usable
      if (transcript === null) {
        const provider = providerFromEnv()
        if (provider === null) {
          throw new UnrecoverableError("No transcription provider configured: set GROQ_API_KEY or OPENAI_API_KEY")
        }

        /// Check the daily cap with this episode's length before paying.
        /// UnrecoverableError skips the retries, since retrying cannot help.
        const estimate = estimateSeconds(fs.statSync(compressedPath).size)
        const remaining = await remainingSeconds()
        if (estimate > remaining) {
          throw new UnrecoverableError(
            `${DAILY_LIMIT_MESSAGE} Needs ${Math.ceil(estimate / 60)} min, ${Math.floor(remaining / 60)} min left.`
          )
        }

        const paid = await transcribeFile(compressedPath, provider)
        transcript = paid
        source = provider.name
        paidSeconds = Math.ceil(paid.durationSeconds ?? estimate)
      }

      transcriptText = transcript.fullText
      console.log(
        `[worker] transcript from ${source}: ${transcriptText.length} chars, ${transcript.segments.length} segments`
      )

      await pool.query(
        `UPDATE transcripts
         SET full_text = $1, segments = $2, source = $3, paid_seconds = $4, completed_at = now(), status = 'done'
         WHERE episode_id = $5`,
        [transcriptText, JSON.stringify(transcript.segments), source, paidSeconds, episodeId]
      )
    }

    /// Clear any partial embeddings from an earlier failed attempt
    await pool.query(`DELETE FROM embeddings WHERE episode_id = $1`, [episodeId])

    const chunks = chunkText(transcriptText, 500)
    console.log(`[worker] embedding ${chunks.length} chunks`)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i] ?? ""
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      })
      const vector = embeddingRes.data[0]?.embedding
      await pool.query(
        `INSERT INTO embeddings (episode_id, chunk_text, embedding, chunk_index)
         VALUES ($1, $2, $3, $4)`,
        [episodeId, chunk, JSON.stringify(vector), i]
      )

      const progress = Math.round(((i + 1) / chunks.length) * 100)
      await pool.query(`UPDATE transcripts SET progress = $1 WHERE episode_id = $2`, [progress, episodeId])
    }

    console.log(`[worker] all done for episode ${episodeId}`)
  },
  { connection }
)

worker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err)

  /// After the last retry, or right away for an error retries cannot fix,
  /// mark the transcript as failed so the UI offers to try again instead of
  /// showing it as in progress forever.
  const lastAttempt = job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1)
  if (job && (lastAttempt || err instanceof UnrecoverableError)) {
    const { episodeId } = job.data as { episodeId: string }
    await pool.query(`UPDATE transcripts SET status = 'failed' WHERE episode_id = $1`, [episodeId])
  }
})

export default worker