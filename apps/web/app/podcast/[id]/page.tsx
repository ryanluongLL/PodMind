'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getPodcast } from '@/lib/api'
import { EpisodeRow } from '@/app/components/EpisodeRow'
import styles from './page.module.css'
import { DifficultyBadge } from '@/app/components/DifficultyBadge'

///need to unwrap with React's use hook for params because Next.js 15 changed params to be a Promise

export default function PodcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    
    /// queryKey includes the id so each podcast gets its own cache entry.
    /// When EpisodeRow mutates an episode, it invalidates this key to trigger a refetch.
    const { data, isLoading } = useQuery({
        queryKey: ['podcast', id],
        queryFn: () => getPodcast(id),
    })

    if (isLoading) return <div className={styles.loading}>Loading...</div>
    if (!data) return <div className={styles.loading}>Not found</div>
    
    const { podcast, episodes } = data

    const difficulties = episodes
        .filter(ep => ep.difficulty)
        .reduce((acc, ep) => {
            acc[ep.difficulty!] = (acc[ep.difficulty!] ?? 0) + 1
            return acc
        }, {} as Record<string, number>)
    
    const difficultyEntries = Object.entries(difficulties)
    
    return (
        <main className={styles.min}>
            <Link href="/" className={styles.backBtn}>
                <ArrowLeft size={16} />
                <span>Back</span>
            </Link>

            {/* Spotify-style header — large cover art on the left, title info on the right */}
            <header className={styles.header}>
                <div className={styles.coverWrapper}>
                    {podcast.icon_url && (
                        <img src={podcast.icon_url} alt={podcast.name} className={styles.cover} />
                    )}
                </div>
                <div className={styles.info}>
                    <p className={styles.label}>Podcast</p>
                    <h1 className={styles.title}>{podcast.name}</h1>
                    <p className={styles.episodeCount}>{episodes.length} episodes</p>
                    {difficultyEntries.length > 0 && (
                        <div className={styles.difficultyRow}>
                            {difficultyEntries.map(([level]) => (
                                <span key={level} className={styles.difficultyPill}>
                                    <DifficultyBadge level={level} />
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <div className={styles.episodeList}>
                {episodes.map((ep) => (
                    <EpisodeRow key={ep.id} episode={ep} podcastName={podcast.name} />
                ))}
            </div>
        </main>
    )

}