import Parser from 'rss-parser'

const parser = new Parser()

export interface ParsedEpisode{
    title: string
    episodeUrl: string
    audioUrl: string | null
    iconUrl: string | null
    publishedAt: Date | null
}

export interface ParsedPodcast{
    name: string
    iconUrl: string | null
    episodes: ParsedEpisode[]
}

export async function scrapeRSS(rssUrl: string): Promise<ParsedPodcast>{
    const feed = await parser.parseURL(rssUrl)

    return {
        name: feed.title ?? 'Unknown Podcast',
        iconUrl: feed.image?.url ?? null,
        episodes: feed.items.slice(0, 20).map((item) => ({
            title: item.title ?? 'Untitled',
            episodeUrl: item.link ?? item.guid ?? '',
            audioUrl: item.enclosure?.url ?? null,
            iconUrl: item.itunes?.image ?? null,
            publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        })),
    }
}