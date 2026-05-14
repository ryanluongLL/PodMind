'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getPodcast } from '@/lib/api'
import { EpisodeRow } from '@/app/components/EpisodeRow'
import styles from './page.module.css'

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