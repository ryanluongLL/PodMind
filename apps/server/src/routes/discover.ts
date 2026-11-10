import { Router } from "express"
import Parser from "rss-parser"
import { isAllowedFeedUrl, previewFromFeed, type DiscoverPreview } from "../discover/feedPreview.js"

export type { DiscoverPreview, LearnerFit } from "../discover/feedPreview.js"

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

const FEED_TIMEOUT_MS = 8000
const MAX_FEEDS = 10
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 300

const parser = new Parser<FeedFields, ItemFields>({ timeout: FEED_TIMEOUT_MS })

/// In memory cache keyed by feed URL. Feeds change slowly, so repeat searches
/// for the same topic within a few hours never refetch the same feeds.
/// Restarting the server clears it.
const cache = new Map<string, { savedAt: number; preview: DiscoverPreview | null }>()

/// Network part only: download and parse the feed, then hand it to the pure
/// previewFromFeed, which holds all the rules and is unit tested.
async function buildPreview(feedUrl: string, genre: string): Promise<DiscoverPreview | null> {
  try {
    const feed = await parser.parseURL(feedUrl)
    return previewFromFeed(feed, genre, Date.now())
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