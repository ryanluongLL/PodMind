import { Router } from "express";
import { pool } from '../db/index.js'
import fs from 'fs'
import path from 'path'
import { error } from "console";

const router = Router()
const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'audio_cache')

// GET /audio/:episodeId
// Streams the cached compressed MP3 with proper byte-range support so the browser can seek (essential for click-to-jump in the transcript).
router.get('/:episodeId', async (req, res) => {
    const { episodeId } = req.params
    const userId = req.userId!

    ///verify the user owns this episode before streaming
    const { rows } = await pool.query(
        `SELECT id FROM episodes WHERE id = $1 AND user_id = $2`,
        [episodeId, userId]
    )
    if (rows.length === 0) {
        res.status(404).json({ error: 'Episode not found' })
        return
    }

    const filePath = path.join(AUDIO_STORAGE_DIR, `${episodeId}.mp3`)
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Audio not cached. Transcribe the episode first.' })
        return
    }

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range

    ///if the browser sends a Range header, serve a byte range (required for seeking)
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0] ?? '0', 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = end - start + 1

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg',
        })

        fs.createReadStream(filePath, {start, end}).pipe(res)
    } else {
        ///no range - send the whole file
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes',
        })
        fs.createReadStream(filePath).pipe(res)
    }
})

export default router