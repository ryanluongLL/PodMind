import { Worker } from "bullmq";
import { pool } from "../db/index.js";
import OpenAI from "openai";
import fs from 'fs'
import path from 'path'
import os from 'os'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'audio_cache')

// Make sure the directory exists on startup
if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
  fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true })
}

function compressAudio(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioChannels(1)
            .audioFrequency(16000)
            .audioBitrate('16k')
            .format('mp3')
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(outputPath)
    })
}

const worker = new Worker(
    'transcription',
    async (job) => {
        const { episodeId, audioUrl, userId } = job.data as {
            episodeId: string
            audioUrl: string
            userId: string
        }
        console.log(`[worker] starting transcription for episode ${episodeId}`)

        await pool.query(
            `UPDATE transcripts SET status = 'processing' WHERE episode_id = $1`,[episodeId]
        )

        // Check if transcript already exists — skip Whisper to save API costs
        const existing = await pool.query(
            `SELECT full_text, segments FROM transcripts WHERE episode_id = $1 AND full_text != ''`,
            [episodeId]
        )

        let transcriptText: string
        let segments: { start: number; end: number; text:string}[]

        if (existing.rows.length > 0 && existing.rows[0].segments) {
            console.log(`[worker] transcript already exists, skipping Whisper`)
            transcriptText = existing.rows[0].full_text
            segments = existing.rows[0].segments
        } else {
            const response = await fetch(audioUrl)
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const rawPath = path.join(os.tmpdir(), `${episodeId}-raw.mp3`)
            const compressedPath = path.join(AUDIO_STORAGE_DIR, `${episodeId}.mp3`)
            fs.writeFileSync(rawPath, buffer)
            console.log(`[worker] audio downloaded, size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`)

            await compressAudio(rawPath, compressedPath)
            const compressedSize = fs.statSync(compressedPath).size
            console.log(`[worker] compressed size: ${(compressedSize / 1024 / 1024).toFixed(1)} MB`)
            if (compressedSize > 25 * 1024 * 1024) {
                fs.unlinkSync(rawPath)
                throw new Error(`Episode too long to transcribe: compressed size ${(compressedSize / 1024 / 1024).toFixed(1)} MB exceeds 25 MB limit`)
            }
            fs.unlinkSync(rawPath)

            ///verbose_json gives us word-level timestamps for the synchronized player
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(compressedPath),
                model: 'whisper-1',
                response_format: 'verbose_json',
            })
            // fs.unlinkSync(compressedPath)
            console.log(`[worker] transcription done, length: ${transcription.text.length} chars`)

            transcriptText = transcription.text
            ///each segments has start/end time in seconds + the spoken text
            segments = (transcription.segments ?? []).map((s) => ({
                start: s.start,
                end: s.end,
                text: s.text.trim(),
            }))
            console.log(`[worker] transcription done: ${transcriptText.length} chars, ${segments.length} segments`)

            await pool.query(
                `UPDATE transcripts SET full_text = $1, segments = $2, status = 'done' WHERE episode_id = $3`,
                [transcriptText, JSON.stringify(segments), episodeId]
            )
        }

        // Also clear any partial embeddings before re-embedding
        await pool.query(`DELETE FROM embeddings WHERE episode_id = $1`, [episodeId])

        const chunks = chunkText(transcriptText, 500)
        console.log(`[worker] embedding ${chunks.length} chunks`)

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i] ?? ''
            const embeddingRes = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunk,
            })
            const vector = embeddingRes.data[0]?.embedding
            await pool.query(
                `INSERT INTO embeddings (episode_id, chunk_text, embedding, chunk_index, user_id)
                VALUES ($1, $2, $3, $4, $5)`,
                [episodeId, chunk, JSON.stringify(vector), i, userId]
            )
        }

        console.log(`[worker] all done for episode ${episodeId}`)
    },
    
    {
        connection: {host: 'localhost', port:6379}
    }
)

function chunkText(text: string, wordsPerChunk: number): string[]{
    const words = text.split(' ')
    const chunks: string[] = []

    for (let i = 0; i < words.length; i += wordsPerChunk){
        chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
    }
    return chunks
}

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err)
})

export default worker