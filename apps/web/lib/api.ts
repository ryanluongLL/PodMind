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

export async function getPodcasts(): Promise<Podcast[]>{
    const { data } = await api.get<Podcast[]>('/podcasts')
    return data
}

export async function addPodcast(url: string): Promise<{ podcast: Podcast; episodeCount: number }>{
    const { data } = await api.post('/podcast', { url })
    return data
}