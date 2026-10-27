import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'audio_cache')

// GET /audio/:episodeId
// Streams the cached compressed MP3 with byte range support so the browser
// can seek, which click to jump in the transcript depends on.
router.get('/:episodeId', (req, res) => {
  const { episodeId } = req.params

  // Episode IDs are UUIDs. Rejecting anything else also blocks path tricks
  // like "../" from reaching the file system.
  if (!/^[0-9a-f-]{36}$/i.test(episodeId)) {
    res.status(400).json({ error: 'Invalid episode id' })
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
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    })
    fs.createReadStream(filePath).pipe(res)
  }
})

export default router