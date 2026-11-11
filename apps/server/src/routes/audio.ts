import { Router } from "express"
import fs from "node:fs"
import path from "node:path"
import { isUuid } from "../utils/ids.js"
import { parseRange } from "../utils/range.js"

const router = Router()

/// Tests point this at a temporary folder. In the app it stays audio_cache.
function audioDir(): string {
  return process.env.AUDIO_CACHE_DIR ?? path.join(process.cwd(), "audio_cache")
}

/// GET /audio/:episodeId
/// Streams the cached compressed MP3 with byte range support so the browser
/// can seek, which click to jump in the transcript depends on.
router.get("/:episodeId", (req, res) => {
  const { episodeId } = req.params

  /// Episode ids are UUIDs. Rejecting anything else also blocks path tricks
  /// like "../" from reaching the file system.
  if (!isUuid(episodeId)) {
    res.status(400).json({ error: "Invalid episode id" })
    return
  }

  const filePath = path.join(audioDir(), `${episodeId}.mp3`)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Audio not cached. Transcribe the episode first." })
    return
  }

  const fileSize = fs.statSync(filePath).size
  const range = parseRange(req.headers.range, fileSize)

  if (range.kind === "unsatisfiable") {
    res.writeHead(416, { "Content-Range": `bytes */${fileSize}` })
    res.end()
    return
  }

  let stream: fs.ReadStream
  if (range.kind === "partial") {
    res.writeHead(206, {
      "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": range.end - range.start + 1,
      "Content-Type": "audio/mpeg",
    })
    stream = fs.createReadStream(filePath, { start: range.start, end: range.end })
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
    })
    stream = fs.createReadStream(filePath)
  }

  /// A read error after the headers went out can only end the response
  stream.on("error", (err) => {
    console.error(`[audio] could not read ${episodeId}`, err)
    res.destroy()
  })
  stream.pipe(res)
})

export default router