import axios from "axios"

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
})

/// Podcasts and episodes (shared library)

export interface Podcast {
  id: string
  name: string
  icon_url: string | null
  rss_url: string | null
  podbean_url: string | null
  episode_count: number
  created_at: string
}

export interface Episode {
  id: string
  podcast_id: string
  title: string
  episode_url: string
  audio_url: string | null
  icon_url: string | null
  published_at: string | null
  transcript_status: "pending" | "processing" | "done" | "failed" | null
  transcript_segments: { start: number; end: number; text: string }[] | null
  difficulty: string | null
  words_per_minute: number | null
  transcript_progress: number | null
}

export async function getPodcasts(): Promise<Podcast[]> {
  const { data } = await api.get<Podcast[]>("/podcasts")
  return data
}

export async function addPodcast(
  url: string,
  iconUrl?: string
): Promise<{ podcast: Podcast; episodeCount: number }> {
  const { data } = await api.post("/podcasts", { url, iconUrl })
  return data
}

export async function getPodcast(id: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  const { data } = await api.get(`/podcasts/${id}`)
  return data
}

/// Removed in Phase C along with the delete button in PodcastCard
export async function deletePodcast(id: string): Promise<void> {
  await api.delete(`/podcasts/${id}`)
}

export async function transcribeEpisode(episodeId: string): Promise<void> {
  await api.post(`/episodes/${episodeId}/transcribe`)
}

export interface DifficultyResult {
  level: string
  wordsPerMinute: number
  reason: string
}

export async function rateEpisodeDifficulty(episodeId: string): Promise<DifficultyResult> {
  const { data } = await api.post<DifficultyResult>(`/episodes/${episodeId}/rate-difficulty`)
  return data
}

/// Semantic search

export interface SearchResult {
  episode_id: string
  chunk_text: string
  chunk_index: string
  episode_title: string
  podcast_name: string
  icon_url: string | null
  episode_url: string
  similarity: number
}

/// Calls GET /search?q=... and returns ranked transcript chunks
export async function searchTranscripts(query: string): Promise<SearchResult[]> {
  const { data } = await api.get<{ query: string; results: SearchResult[] }>("/search", {
    params: { q: query },
  })
  return data.results
}

/// Word lookup

export interface ExampleSentence {
  text: string
  episodeId: string
  episodeTitle: string
  podcastName: string
  start: number
  audioUrl: string | null
  iconUrl: string | null
}

export interface WordRarity {
  rank: number | null
  band: "very common" | "common" | "less common" | "rare"
  label: string
}

export interface OtherMeaning {
  partOfSpeech: string
  definition: string
}

export interface TranslationResult {
  word: string
  lemma: string
  translation: string
  partOfSpeech: string
  definition: string
  otherMeanings: OtherMeaning[]
  rarity: WordRarity
  examples: ExampleSentence[]
}

/// Looks up a word in its sentence. Built server side from context tagging,
/// weighted Lesk over WordNet, transcript examples, and word frequency.
export async function translateWord(
  word: string,
  targetLang: string,
  context: string,
  episodeId: string
): Promise<TranslationResult> {
  const { data } = await api.post<TranslationResult>("/translate", {
    word,
    targetLang,
    context,
    episodeId,
  })
  return data
}

/// iTunes podcast directory (called directly from the browser, no API key)

export interface ItunesPodcast {
  collectionId: number
  trackName: string
  artistName: string
  artworkUrl600: string
  artworkUrl100: string
  feedUrl: string
  primaryGenreName: string
  trackCount: number
  description?: string
  contentAdvisoryRating?: string
}

interface ItunesSearchResponse {
  resultCount: number
  results: ItunesPodcast[]
}

export async function searchItunesPodcasts(query: string): Promise<ItunesPodcast[]> {
  if (!query.trim()) {
    return []
  }
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=10`
  const res = await fetch(url)
  const data: ItunesSearchResponse = await res.json()
  /// Only podcasts with a feed URL can be added to the library
  return data.results.filter((r) => r.feedUrl)
}

/// Top podcasts for the empty search state. The top chart endpoint returns a
/// different shape without feed URLs, so each name is searched again to get one.
export async function getTrendingPodcasts(): Promise<ItunesPodcast[]> {
  const url = "https://itunes.apple.com/us/rss/toppodcasts/limit=10/genre=1310/json"
  const res = await fetch(url)
  const data = await res.json()

  const entries = data.feed?.entry ?? []
  const topNames = entries
    .slice(0, 10)
    .map((e: { "im:name": { label: string } }) => e["im:name"].label)

  const searches = await Promise.all(topNames.map((name: string) => searchItunesPodcasts(name)))
  return searches.map((results) => results[0]).filter((p): p is ItunesPodcast => Boolean(p))
}

export async function discoverPodcasts(query: string): Promise<ItunesPodcast[]> {
  if (!query.trim()) {
    return []
  }
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=5`
  const res = await fetch(url)
  const data: ItunesSearchResponse = await res.json()
  return data.results.filter((r) => r.feedUrl)
}

/// Removed in Phase C along with Clerk
export function setupAuthInterceptor(getToken: () => Promise<string | null>) {
  api.interceptors.request.use(async (config) => {
    const token = await getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })
}