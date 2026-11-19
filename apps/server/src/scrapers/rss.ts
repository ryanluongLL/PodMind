import Parser from "rss-parser"
import { pickTranscript, type FeedTranscriptLink, type TranscriptFormat } from "../transcripts/feedTranscript.js"

/// A <podcast:transcript url="..." type="..." language="..."/> tag, as
/// rss-parser hands it over: the tag's attributes live under "$".
interface RawTranscriptTag {
  $?: { url?: string; type?: string; language?: string }
}

interface CustomItem {
  transcripts?: RawTranscriptTag[]
  itunes?: { image?: string }
}

/// keepArray keeps every transcript tag, since one episode can link to
/// several formats or languages and we pick the best one ourselves.
const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [["podcast:transcript", "transcripts", { keepArray: true }]],
  },
})

export const MAX_EPISODES = 20

export interface ParsedEpisode {
  title: string
  /// What makes this episode unique within its feed (see episodeKeyFor)
  guid: string
  /// Where "Open original episode" links to
  episodeUrl: string
  audioUrl: string | null
  iconUrl: string | null
  publishedAt: Date | null
  /// The free transcript the publisher links in the feed, when there is one.
  /// Optional so tests can build episodes without spelling it out.
  transcript?: { url: string; format: TranscriptFormat } | null
}

export interface ParsedPodcast {
  name: string
  iconUrl: string | null
  episodes: ParsedEpisode[]
}

type Feed = Parser.Output<CustomItem>
type FeedItem = Feed["items"][number]

export function transcriptLinks(item: CustomItem): FeedTranscriptLink[] {
  const links: FeedTranscriptLink[] = []
  for (const tag of item.transcripts ?? []) {
    const attributes = tag.$
    if (!attributes?.url) {
      continue
    }
    const link: FeedTranscriptLink = { url: attributes.url }
    if (attributes.type) {
      link.type = attributes.type
    }
    if (attributes.language) {
      link.language = attributes.language
    }
    links.push(link)
  }
  return links
}

/// The episode page link when it is a real web address, otherwise the guid,
/// otherwise the audio file. Only used for the "Open original episode" link,
/// since many feeds give every episode the same link.
function episodeUrlFor(item: FeedItem): string {
  if (item.link?.startsWith("http")) {
    return item.link
  }
  return item.guid ?? item.enclosure?.url ?? ""
}

/// RSS made <guid> to tell episodes apart, so it comes first. Feeds without
/// one fall back to the audio file, which is almost always unique, then the
/// link, then the title and date.
export function episodeKeyFor(item: FeedItem): string {
  const guid = item.guid?.trim()
  if (guid) {
    return guid
  }
  const audio = item.enclosure?.url?.trim()
  if (audio) {
    return audio
  }
  const link = item.link?.trim()
  if (link) {
    return link
  }
  return `${item.title ?? "Untitled"}|${item.pubDate ?? ""}`
}

export function mapFeed(feed: Feed): ParsedPodcast {
  return {
    name: feed.title ?? "Unknown Podcast",
    iconUrl: feed.image?.url ?? null,
    episodes: feed.items.slice(0, MAX_EPISODES).map((item) => ({
      title: item.title ?? "Untitled",
      guid: episodeKeyFor(item),
      episodeUrl: episodeUrlFor(item),
      audioUrl: item.enclosure?.url ?? null,
      iconUrl: item.itunes?.image ?? null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      transcript: pickTranscript(transcriptLinks(item)),
    })),
  }
}

/// Parses feed XML that is already downloaded. Unit tests call this directly.
export async function parseFeed(xml: string): Promise<ParsedPodcast> {
  return mapFeed(await parser.parseString(xml))
}

export async function scrapeRSS(rssUrl: string): Promise<ParsedPodcast> {
  return mapFeed(await parser.parseURL(rssUrl))
}