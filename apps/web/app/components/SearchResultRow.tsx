'use client'

import { ExternalLink } from "lucide-react"
import type { SearchResult } from "@/lib/api"
import styles from './SearchResultRow.module.css'


///highlights the query terms within the transcript snippet
///splits the chunk by each query word (case-insensitive) and wraps matches in <mark>
function highlightMatches(text: string, query: string): React.ReactNode{
    if (!query.trim()) return text
    ///throw away any words that are 2 chars or shorter plus multiple spaces
    const words = query.trim().split(/\s+/).filter((w) => w.length > 2)
    if (words.length === 0) return text

    const pattern = new RegExp(`(${words.map(escapeRegex).join('|')})`, 'gi')
    const parts = text.split(pattern)

    return parts.map((part, i) =>
        pattern.test(part) ? (
            <mark key={i} className={styles.highlight}>
                {part}
            </mark>
        ) : (
                <span key={i}>{part}</span>
        )
    )
}

function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function SearchResultRow({
    result,
    query,
    rank,
}: {
        result: SearchResult
        query: string
        rank:number
    }) {
    
    ///format similarity as a percentage for readability (0.82 -> 82%)
    const similarityPct = Math.round(result.similarity * 100)

    return (
        <div className={styles.row}>
            <div className={styles.rankBadge}>
                {rank}
            </div>

            <div className={styles.iconWrapper}>
                {result.icon_url && (
                    <img src={result.icon_url} alt="" className={styles.icon} />
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.headerRow}>
                    <div>
                        <p className={styles.podcastName}>{result.podcast_name}</p>
                        <h3 className={styles.episodeTitle}>{result.episode_title}</h3>
                    </div>
                    <div className={styles.similarity}>
                        <span className={styles.similarityPct}>{similarityPct}</span>
                        <span className={styles.similarityLabel}>match</span>
                    </div>
                </div>

                <p className={styles.excerpt}>
                    &ldquo;{highlightMatches(result.chunk_text.slice(0, 400), query)}
                    {result.chunk_text.length > 400 && '...'}&rdquo;
                </p>

                {result.episode_url && (
                    <a
                        href={result.episode_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                    >
                        <ExternalLink size={14} />
                        Listen
                    </a>
                )}
            </div>
        </div>
    )
}