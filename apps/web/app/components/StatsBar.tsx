'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { getStats } from '@/lib/api'
import styles from './StatsBar.module.css'

function plural(count: number, word: string): string {
  if (count === 1) {
    return `${count} ${word}`
  }
  return `${count} ${word}s`
}

export function StatsBar() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  })

  if (isLoading) {
    return <div className={styles.skeleton} />
  }

  if (!stats) {
    return null
  }

  return (
    <div className={styles.bar}>
      <p className={styles.line}>
        <span>{plural(stats.streak, 'day')} streak</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span>{plural(stats.wordsThisWeek, 'word')} saved this week</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span>{plural(stats.episodesTranscribed, 'episode')} transcribed</span>
      </p>

      {stats.wordsDueForReview > 0 && (
        <Link href="/review" className={styles.reviewLink}>
          Review {plural(stats.wordsDueForReview, 'word')}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}