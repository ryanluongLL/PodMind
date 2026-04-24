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
}

export async function getPodcasts(): Promise<Podcast[]>{
    const { data } = await api.get<Podcast[]>('/podcasts')
    return data
}

export async function addPodcast(url: string): Promise<{ podcast: Podcast; episodeCount: number }>{
    const { data } = await api.post('/podcast', { url })
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