import axios from "axios";

export const api = axios.create({
    baseURL: 'http://localhost:3001',
})

export interface Podcast{
    id: string
    name: string
    icon_url: string | null
    rss_url: string | null
    podbean_url: string | null
    episode_count: number
    created_at:string
}

export interface Episode{
    id: string
    podcast_id: string
    title: string
    episode_url: string
    audio_url: string | null
    icon_url: string | null
    published_at: string | null
    is_favorite: boolean
    rating: number | null
    hashtags: string[]
    transcript_status: 'pending' | 'processing' | 'done' | 'failed' | null
    transcript_segments: { start: number; end: number; text: string }[] | null
}

export async function getPodcasts(): Promise<Podcast[]>{
    const { data } = await api.get<Podcast[]>('/podcasts')
    return data
}

export async function addPodcast(url: string, iconUrl?: string): Promise<{ podcast: Podcast; episodeCount: number }>{
    const { data } = await api.post('/podcasts', { url, iconUrl })
    return data
}

export async function getPodcast(id: string): Promise<{ podcast: Podcast; episodes: Episode[] }>{
    const { data } = await api.get(`/podcasts/${id}`)
    return data
}

export async function toggleFavorite(episodeId: string, isFavorite: boolean): Promise<void>{
    await api.patch(`/episodes/${episodeId}`, {is_favorite: isFavorite})
}

export async function transcribeEpisode(episodeId: string): Promise<void>{
    await api.post(`/episodes/${episodeId}/transcribe`)
}

export interface SearchResult{
    episode_id: string
    chunk_text: string
    chunk_index: string
    episode_title: string
    podcast_name: string
    icon_url: string | null
    episode_url: string
    similarity: number
}

///calls GET /search?q=... and returns ranked transcript chunks

export async function searchTranscripts(query: string): Promise<SearchResult[]>{
    const { data } = await api.get<{ query: string; results: SearchResult[] }>('/search', {
        params: {q:query},
    })
    return data.results
}

///wire up the auth token to every request
export function setupAuthInterceptor(getToken: () => Promise<string | null>) {
    api.interceptors.request.use(async (config) => {
        const token = await getToken()
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    })
}

export interface ItunesPodcast{
    collectionId: number
    trackName: string           ///podcast name
    artistName: string          ///creater/host
    artworkUrl600: string       ///high-res cover
    artworkUrl100: string       ///smaller cover
    feedUrl: string
    primaryGenreName: string
    trackCount: number
    description?: string        
    contentAdvisoryRating?: string
}

interface ItunesSearchResponse{
    resultCount: number
    results: ItunesPodcast[]
}

///search the iTunes podcast catalog. No API key needed
///direct call from the browser, bypasses our backend

export async function searchItunesPodcasts(query: string): Promise<ItunesPodcast[]>{
    if (!query.trim()) return []
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=10`
    const res = await fetch(url)
    const data: ItunesSearchResponse = await res.json()
    ///filter out any results without a feed URL
    return data.results.filter((r) => r.feedUrl)
}

//fetch top podcasts for the empty-state "Trending" view
export async function getTrendingPodcasts(): Promise<ItunesPodcast[]>{
    const url = `https://itunes.apple.com/us/rss/toppodcasts/limit=10/genre=1310/json`
    const res = await fetch(url)
    const data = await res.json()

    ///the "top podcasts" RSS endpoint returns a different shape, need to re-search by name to get the proper feedUrl that our backend can scrape
    const entries = data.feed?.entry ?? []
    const top10Names = entries.slice(0, 10).map((e: { 'im:name': { label: string } }) => e['im:name'].label)

    ///run a search for each top podcast name in parallel and grab the first match
    const searches = await Promise.all(top10Names.map((name: string) => searchItunesPodcasts(name)))
   return searches.map((results) => results[0]).filter((p): p is ItunesPodcast => Boolean(p))
}

export async function discoverPodcasts(query: string): Promise<ItunesPodcast[]>{
    if (!query.trim()) return []
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=5`
    const res = await fetch(url)
    const data: ItunesSearchResponse = await res.json()
    return data.results.filter((r) => r.feedUrl)

}

export async function deletePodcast(id: string): Promise<void>{
    await api.delete(`/podcasts/${id}`)
}

export interface UserProfile {
  user_id: string
  native_language: string
  english_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  daily_goal_minutes: number
  current_streak: number
  last_active_date: string | null
  onboarded: boolean
  created_at: string
}

export async function getProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/profile')
  return data
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>('/profile', updates)
  return data
}

export interface TranslationResult{
    word: string
    translation: string
    partOfSpeech: string
    definition: string
    usageNote: string
    exampleSentence: string
}

///translates a word with full context- definition, usage, and example sentence
export async function translateWord(
    word: string,
    targetLang: string,
    context: string
): Promise<TranslationResult>{
    const { data } = await api.post<TranslationResult>('/translate', {
        word,
        targetLang,
        context,
    })
    return data
}