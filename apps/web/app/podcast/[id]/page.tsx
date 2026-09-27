'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getPodcast } from '@/lib/api'
import { EpisodeRow } from '@/app/components/EpisodeRow'
import { DifficultyBadge } from '@/app/components/DifficultyBadge'
import styles from './page.module.css'

export default function PodcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data, isLoading } = useQuery({
    queryKey: ['podcast', id],
    queryFn: () => getPodcast(id),
  })

  if (isLoading) {
    return (
      <main className={styles.main}>
        <p className={styles.status}>Loading episodes...</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className={styles.main}>
        <p className={styles.status}>Podcast not found.</p>
      </main>
    )
  }

  const { podcast, episodes } = data

  const transcribedCount = episodes.filter((ep) => ep.transcript_status === 'done').length

  const difficulties = episodes
    .filter((ep) => ep.difficulty)
    .reduce((acc, ep) => {
      const level = ep.difficulty as string
      acc[level] = (acc[level] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

  const difficultyEntries = Object.entries(difficulties)

  return (
    <main className={styles.main}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>Library</span>
        </Link>
      </div>

      <header className={styles.header}>
        <div className={styles.coverWrapper}>
          {podcast.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={podcast.icon_url} alt={podcast.name} className={styles.cover} />
          ) : (
            <div className={styles.coverFallback}>{podcast.name.charAt(0)}</div>
          )}
        </div>

        <div className={styles.info}>
          <p className={styles.label}>Podcast</p>
          <h1 className={styles.title}>{podcast.name}</h1>

          <div className={styles.metaRow}>
            <span>{episodes.length} episodes</span>
            <span className={styles.metaDot} aria-hidden="true">·</span>
            <span>{transcribedCount} transcribed</span>
            {difficultyEntries.length > 0 && (
              <span className={styles.metaDot} aria-hidden="true">·</span>
            )}
            {difficultyEntries.map(([level, count]) => (
              <span key={level} className={styles.difficultyPill}>
                <DifficultyBadge level={level} />
                <span className={styles.difficultyCount}>×{count}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.episodeSection}>
        <h2 className={styles.sectionTitle}>Episodes</h2>
        <div className={styles.episodeList}>
          {episodes.map((ep) => (
            <EpisodeRow
              key={ep.id}
              episode={{ ...ep, icon_url: ep.icon_url ?? podcast.icon_url }}
              podcastName={podcast.name}
            />
          ))}
        </div>
      </section>
    </main>
  )
}