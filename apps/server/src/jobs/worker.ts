import { Worker } from "bullmq"
import { Redis } from "ioredis"
import { pool } from "../db/index.js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
import os from "os"
import ffmpeg from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import { feedTranscriptFor } from "../transcripts/feedTranscriptSource.js"
import type { Segment } from "../transcripts/feedTranscript.js"

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const AUDIO_STORAGE_DIR = path.join(process.cwd(), "audio_cache")

if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
  fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true })
}

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

type TranscriptSource = "feed" | "openai"

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

/// Paid transcription. Only reached when the feed has no usable transcript.
async function transcribeWithOpenAI(compressedPath: string): Promise<{ fullText: string; segments: Segment[] }> {
  const compressedSize = fs.statSync(compressedPath).size
  if (compressedSize > WHISPER_MAX_BYTES) {
    throw new Error(
      `Episode too long to transcribe: ${(compressedSize / 1024 / 1024).toFixed(1)} MB exceeds 25 MB limit`
    )
  }

  /// verbose_json gives segment timestamps for the synchronized player
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(compressedPath),
    model: "whisper-1",
    response_format: "verbose_json",
  })

  return {
    fullText: transcription.text,
    segments: (transcription.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
  }
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

      if (transcript === null) {
        transcript = await transcribeWithOpenAI(compressedPath)
        source = "openai"
      }

      transcriptText = transcript.fullText
      console.log(
        `[worker] transcript from ${source}: ${transcriptText.length} chars, ${transcript.segments.length} segments`
      )

      await pool.query(
        `UPDATE transcripts SET full_text = $1, segments = $2, source = $3, status = 'done' WHERE episode_id = $4`,
        [transcriptText, JSON.stringify(transcript.segments), source, episodeId]
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

  /// After the last retry, mark the transcript as failed so the UI stops
  /// showing it as in progress forever.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const { episodeId } = job.data as { episodeId: string }
    await pool.query(`UPDATE transcripts SET status = 'failed' WHERE episode_id = $1`, [episodeId])
  }
})

export default worker