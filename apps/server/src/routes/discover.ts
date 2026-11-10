import { Router } from "express"
import Parser from "rss-parser"

const router = Router()

/// Feed fields we read beyond rss-parser's defaults
interface FeedFields {
  language?: string
  description?: string
  itunes?: { summary?: string }
}

interface ItemFields {
  isoDate?: string
  pubDate?: string
  itunes?: { duration?: string | number }
}

export interface LearnerFit {
  level: "great" | "good" | "hard"
  label: string
  reasons: string[]
}

export interface DiscoverPreview {
  description: string
  medianMinutes: number | null
  cadence: string | null
  daysSinceLastEpisode: number | null
  isEnglish: boolean | null
  fit: LearnerFit
}

const FEED_TIMEOUT_MS = 8000
const MAX_FEEDS = 10
const RECENT_EPISODES = 10
const DESCRIPTION_MAX_CHARS = 240
const STALE_AFTER_DAYS = 90
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 300
const DAY_MS = 24 * 60 * 60 * 1000

const parser = new Parser<FeedFields, ItemFields>({ timeout: FEED_TIMEOUT_MS })

/// In memory cache keyed by feed URL. Feeds change slowly, so repeat searches
/// for the same topic within a few hours never refetch the same feeds.
/// Restarting the server clears it.
const cache = new Map<string, { savedAt: number; preview: DiscoverPreview | null }>()

/// The server downloads URLs that come from the browser, so only allow public
/// http(s) addresses. This blocks the common ways of pointing the server at its
/// own machine or private network. It does not cover every trick (such as a
/// public hostname that resolves to a private address), so it is a basic guard.
function isAllowedFeedUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) {
    return false
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return false
  }
  if (host.startsWith("[")) {
    return false
  }
  return true
}

/// itunes:duration comes as seconds ("754"), "MM:SS", or "HH:MM:SS"
function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const text = String(value).trim()
  if (text.length === 0) {
    return null
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(parseFloat(text))
  }
  const parts = text.split(":").map(Number)
  if (parts.some((p) => Number.isNaN(p))) {
    return null
  }
  let seconds = 0
  for (const part of parts) {
    seconds = seconds * 60 + part
  }
  return seconds
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? null
}

/// Feed descriptions are often HTML. Strip tags, decode the common entities,
/// and keep whole sentences up to a length that fits a card.
function cleanDescription(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()

  if (text.length <= DESCRIPTION_MAX_CHARS) {
    return text
  }

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)
  let result = ""
  if (sentences) {
    for (const sentence of sentences) {
      if (result.length > 0 && (result + sentence).length > DESCRIPTION_MAX_CHARS) {
        break
      }
      result += sentence
    }
  }

  /// No sentence break early enough: cut at the last full word instead
  if (result.trim().length === 0 || result.length > DESCRIPTION_MAX_CHARS) {
    const cut = text.slice(0, DESCRIPTION_MAX_CHARS)
    const lastSpace = cut.lastIndexOf(" ")
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length)}...`
  }
  return result.trim()
}

/// The release schedule word on its own: "daily", "weekly", and so on.
/// Null when episodes are too far apart to call it a schedule.
function cadenceWord(gapDays: number): string | null {
  if (gapDays <= 1.5) {
    return "daily"
  }
  if (gapDays <= 4) {
    return "several times a week"
  }
  if (gapDays <= 8) {
    return "weekly"
  }
  if (gapDays <= 16) {
    return "every two weeks"
  }
  if (gapDays <= 35) {
    return "about monthly"
  }
  return null
}

function cadenceLabel(gapDays: number): string {
  const word = cadenceWord(gapDays)
  if (word === null) {
    return "Irregular schedule"
  }
  return `New episodes ${word}`
}

/// "5 months ago", "1 year ago", used when a show has stopped publishing
function timeAgo(days: number): string {
  if (days < 60) {
    return `${days} days ago`
  }
  if (days < 365) {
    return `${Math.round(days / 30)} months ago`
  }
  const years = Math.round(days / 365)
  if (years === 1) {
    return "1 year ago"
  }
  return `${years} years ago`
}

/// Rule based learner fit. Short episodes are easier to finish and re-listen
/// to, a regular schedule builds a habit, and shows made for learners speak
/// more clearly. Every point added or removed is explained in reasons.
///
/// The schedule is measured from the gaps between past episodes, so it says
/// how often a show used to publish. If the show has gone quiet, the reason
/// says so in one line instead of claiming a schedule that no longer holds,
/// and the schedule bonus is not given.
function scoreFit(input: {
  genre: string
  medianMinutes: number | null
  gapDays: number | null
  daysSinceLast: number | null
  isEnglish: boolean | null
}): LearnerFit {
  if (input.isEnglish === false) {
    return {
      level: "hard",
      label: "Not in English",
      reasons: ["The feed says this show is in another language"],
    }
  }

  let score = 0
  const reasons: string[] = []

  if (input.genre.toLowerCase().includes("language")) {
    score += 2
    reasons.push("Made for language learners")
  }

  if (input.medianMinutes !== null) {
    if (input.medianMinutes <= 15) {
      score += 2
      reasons.push(`Short episodes, about ${input.medianMinutes} min`)
    } else if (input.medianMinutes <= 35) {
      score += 1
      reasons.push(`Episodes about ${input.medianMinutes} min`)
    } else {
      reasons.push(`Long episodes, about ${input.medianMinutes} min`)
    }
  }

  const isStale = input.daysSinceLast !== null && input.daysSinceLast > STALE_AFTER_DAYS

  if (isStale && input.daysSinceLast !== null) {
    score -= 1
    let word: string | null = null
    if (input.gapDays !== null) {
      word = cadenceWord(input.gapDays)
    }
    if (word !== null) {
      reasons.push(`Was ${word}, last episode ${timeAgo(input.daysSinceLast)}`)
    } else {
      reasons.push(`Last episode ${timeAgo(input.daysSinceLast)}`)
    }
  } else if (input.gapDays !== null && input.gapDays <= 8) {
    score += 1
    reasons.push(cadenceLabel(input.gapDays))
  }

  if (score >= 3) {
    return { level: "great", label: "Great for learners", reasons }
  }
  if (score >= 1) {
    return { level: "good", label: "Good for learners", reasons }
  }
  return { level: "hard", label: "Harder for learners", reasons }
}

async function buildPreview(feedUrl: string, genre: string): Promise<DiscoverPreview | null> {
  try {
    const feed = await parser.parseURL(feedUrl)

    const description = cleanDescription(feed.description ?? feed.itunes?.summary ?? "")

    /// Most recent episodes first, with valid dates only
    const dated = feed.items
      .map((item) => ({
        time: new Date(item.isoDate ?? item.pubDate ?? "").getTime(),
        seconds: parseDurationSeconds(item.itunes?.duration),
      }))
      .filter((item) => !Number.isNaN(item.time))
      .sort((a, b) => b.time - a.time)
      .slice(0, RECENT_EPISODES)

    const durations: number[] = []
    for (const item of dated) {
      if (item.seconds !== null && item.seconds > 0) {
        durations.push(item.seconds)
      }
    }
    const medianSeconds = median(durations)
    let medianMinutes: number | null = null
    if (medianSeconds !== null) {
      medianMinutes = Math.max(1, Math.round(medianSeconds / 60))
    }

    const gaps: number[] = []
    for (let i = 1; i < dated.length; i++) {
      const newer = dated[i - 1]
      const older = dated[i]
      if (newer && older) {
        gaps.push((newer.time - older.time) / DAY_MS)
      }
    }
    const gapDays = median(gaps)

    let daysSinceLast: number | null = null
    const latest = dated[0]
    if (latest) {
      daysSinceLast = Math.max(0, Math.floor((Date.now() - latest.time) / DAY_MS))
    }

    let isEnglish: boolean | null = null
    if (feed.language) {
      isEnglish = feed.language.toLowerCase().startsWith("en")
    }

    /// Only report a current schedule for shows that are still publishing
    let cadence: string | null = null
    const isStale = daysSinceLast !== null && daysSinceLast > STALE_AFTER_DAYS
    if (gapDays !== null && !isStale) {
      cadence = cadenceLabel(gapDays)
    }

    return {
      description,
      medianMinutes,
      cadence,
      daysSinceLastEpisode: daysSinceLast,
      isEnglish,
      fit: scoreFit({ genre, medianMinutes, gapDays, daysSinceLast, isEnglish }),
    }
  } catch (err) {
    console.error(`[discover] could not read feed ${feedUrl}`, err)
    return null
  }
}

async function getPreview(feedUrl: string, genre: string): Promise<DiscoverPreview | null> {
  const hit = cache.get(feedUrl)
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS) {
    return hit.preview
  }

  const preview = await buildPreview(feedUrl, genre)

  /// Map keeps insertion order, so the first key is the oldest entry
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
  cache.set(feedUrl, { savedAt: Date.now(), preview })
  return preview
}

/// POST /discover/preview
/// Body: { podcasts: [{ feedUrl, genre }] }
/// Reads each feed in parallel and returns a learner focused preview, or null
/// for feeds that could not be read. No AI involved.
router.post("/preview", async (req, res) => {
  const { podcasts } = req.body as { podcasts?: { feedUrl?: string; genre?: string }[] }

  if (!Array.isArray(podcasts) || podcasts.length === 0) {
    res.status(400).json({ error: "podcasts must be a non empty array" })
    return
  }

  const startedAt = Date.now()
  const list = podcasts.slice(0, MAX_FEEDS)

  const results = await Promise.all(
    list.map(async (p) => {
      const feedUrl = p.feedUrl ?? ""
      if (!isAllowedFeedUrl(feedUrl)) {
        return { feedUrl, preview: null }
      }
      const preview = await getPreview(feedUrl, p.genre ?? "")
      return { feedUrl, preview }
    })
  )

  const previews: Record<string, DiscoverPreview | null> = {}
  for (const result of results) {
    previews[result.feedUrl] = result.preview
  }

  console.log(`[discover] ${list.length} previews in ${Date.now() - startedAt}ms`)
  res.json({ previews })
})

export default router