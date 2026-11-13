/// Turns a transcript file that a podcast publishes in its feed (the
/// Podcasting 2.0 <podcast:transcript> tag) into the same timed segments the
/// worker gets back from Whisper. Using these files costs nothing, so the
/// worker only pays for transcription when a feed has none.
/// Pure functions: no network, no database, so every rule is unit tested.

export interface Segment {
  start: number
  end: number
  text: string
}

export type TranscriptFormat = "vtt" | "srt" | "json"

export interface FeedTranscriptLink {
  url: string
  type?: string
  language?: string
}

/// Short cues get joined until a sentence ends or the joined cue reaches this
/// many seconds, so word level files still give readable lines in the player.
export const MAX_MERGED_SECONDS = 12

/// Formats with timestamps, in the order we prefer them. Plain text and HTML
/// transcripts have no timing, so the player could not sync them.
const FORMAT_BY_TYPE: Record<string, TranscriptFormat> = {
  "text/vtt": "vtt",
  "application/x-subrip": "srt",
  "application/srt": "srt",
  "text/srt": "srt",
  "application/json": "json",
}
const FORMAT_PRIORITY: TranscriptFormat[] = ["vtt", "srt", "json"]

export function formatFromType(type: string | undefined): TranscriptFormat | null {
  if (!type) {
    return null
  }
  const clean = type.split(";")[0]?.trim().toLowerCase() ?? ""
  return FORMAT_BY_TYPE[clean] ?? null
}

function isEnglish(language: string | undefined): boolean {
  if (!language) {
    return true
  }
  return language.toLowerCase().startsWith("en")
}

/// Picks the best timed, English transcript from a feed item, or null when
/// there is none and the episode has to go through paid transcription.
export function pickTranscript(
  links: FeedTranscriptLink[]
): { url: string; format: TranscriptFormat } | null {
  for (const format of FORMAT_PRIORITY) {
    for (const link of links) {
      if (!link.url || !link.url.startsWith("http")) {
        continue
      }
      if (formatFromType(link.type) === format && isEnglish(link.language)) {
        return { url: link.url, format }
      }
    }
  }
  return null
}

/// Accepts "01:02:03.456", "02:03.456", and the SRT style "01:02:03,456".
export function parseTimestamp(raw: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(raw.trim())
  if (!match) {
    return null
  }
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const millis = Number((match[4] ?? "0").padEnd(3, "0"))
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

/// Removes voice and styling tags such as <v Host>, <c.yellow>, <b>, and
/// decodes the few HTML entities that show up in caption files.
function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/// VTT and SRT share the same cue shape: an optional id line, a
/// "start --> end" line, then one or more text lines, with blank lines between cues.
function parseCueFile(content: string): Segment[] {
  const blocks = content.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
  const segments: Segment[] = []

  for (const block of blocks) {
    const lines = block.split("\n")
    const timingIndex = lines.findIndex((line) => line.includes("-->"))
    if (timingIndex === -1) {
      continue
    }

    const timing = lines[timingIndex] ?? ""
    const [startRaw = "", rest = ""] = timing.split("-->")
    /// VTT allows cue settings after the end time, like "align:start"
    const endRaw = rest.trim().split(/\s+/)[0] ?? ""
    const start = parseTimestamp(startRaw)
    const end = parseTimestamp(endRaw)
    const text = cleanCueText(lines.slice(timingIndex + 1).join(" "))

    if (start === null || end === null || text === "") {
      continue
    }
    segments.push({ start, end, text })
  }

  return segments
}

/// The Podcasting 2.0 JSON format:
/// { "segments": [{ "startTime": 0, "endTime": 1.5, "body": "Hello" }] }
function parseJsonTranscript(content: string): Segment[] {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    return []
  }
  if (typeof data !== "object" || data === null) {
    return []
  }
  const rawSegments = (data as { segments?: unknown }).segments
  if (!Array.isArray(rawSegments)) {
    return []
  }

  const segments: Segment[] = []
  for (const item of rawSegments) {
    const { startTime, endTime, body } = item as {
      startTime?: unknown
      endTime?: unknown
      body?: unknown
    }
    if (typeof startTime !== "number" || typeof endTime !== "number" || typeof body !== "string") {
      continue
    }
    const text = cleanCueText(body)
    if (text !== "") {
      segments.push({ start: startTime, end: endTime, text })
    }
  }
  return segments
}

/// Some hosts send the wrong content type, so the file itself gets the last word.
export function detectFormat(content: string, declared: TranscriptFormat | null): TranscriptFormat | null {
  const head = content.trimStart()
  if (head.startsWith("WEBVTT")) {
    return "vtt"
  }
  if (head.startsWith("{")) {
    return "json"
  }
  if (head.includes("-->")) {
    return "srt"
  }
  return declared
}

function endsSentence(text: string): boolean {
  return /[.!?]["')\]]?$/.test(text)
}

/// Joins short cues into sentence sized lines. A cue that already ends a
/// sentence, or a join that would pass MAX_MERGED_SECONDS, starts a new line.
export function mergeSegments(segments: Segment[], maxSeconds = MAX_MERGED_SECONDS): Segment[] {
  const merged: Segment[] = []
  let current: Segment | null = null

  for (const segment of segments) {
    if (current === null) {
      current = { ...segment }
    } else if (segment.end - current.start <= maxSeconds && !endsSentence(current.text)) {
      current.end = segment.end
      current.text = `${current.text} ${segment.text}`
    } else {
      merged.push(current)
      current = { ...segment }
    }
  }

  if (current !== null) {
    merged.push(current)
  }
  return merged
}

/// Parses a downloaded transcript file. Returns null when nothing usable
/// came out of it, which tells the worker to fall back to transcription.
export function parseTranscript(
  content: string,
  declared: TranscriptFormat | null
): { fullText: string; segments: Segment[] } | null {
  const format = detectFormat(content, declared)
  if (format === null) {
    return null
  }

  let segments: Segment[]
  if (format === "json") {
    segments = parseJsonTranscript(content)
  } else {
    segments = parseCueFile(content)
  }

  segments = mergeSegments(segments.sort((a, b) => a.start - b.start))
  if (segments.length === 0) {
    return null
  }

  const fullText = segments.map((segment) => segment.text).join(" ")
  return { fullText, segments }
}