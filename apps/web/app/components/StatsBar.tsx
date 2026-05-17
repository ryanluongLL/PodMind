'use client'

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Flame, BookMarked, Sparkles, Mic } from 'lucide-react'
import { getStats } from "@/lib/api"
import styles from './StatsBar.module.css'

// Dashboard stats bar shown on the home page.
// Shows streak, words saved this week, words due for review, and transcribed episodes.
// Each stat is a clickable card linking to the relevant page.
export function StatsBar() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['stats'],
        queryFn: getStats,
    })

    if (isLoading) return <div className={styles.loading}>
        {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.skeleton}  />
        ))}
    </div>

    if (!stats) return null
    
    return (
        <div className={styles.bar}>
            <div className={`${styles.stat} ${styles.statStreak}`}>
                <Flame size={20} className={styles.icon} />
                <div>
                    <p className={styles.value}>{stats.streak}</p>
                    <p className={styles.label}>day streak</p>
                </div>
            </div>

            <div className={styles.stat}>
                <BookMarked size={20} className={styles.icon} />
                <div>
                    <p className={styles.value}>{stats.wordsThisWeek}</p>
                    <p className={styles.label}>words this week</p>
                </div>
            </div>

            <Link href="/review" className={`${styles.stat} ${stats.wordsDueForReview}`} >
                <Sparkles size={20} className={styles.icon} />
                <div>
                    <p className={styles.value}>{stats.wordsDueForReview}</p>
                    <p className={styles.label}>due for review</p>
                </div>
            </Link>

            <div className={styles.stat}>
                <Mic size={20} className={styles.icon} />
                <div>
                    <p className={styles.value}>{stats.episodesTranscribed}</p>
                    <p className={styles.label}>transcribed</p>
                </div>
            </div>
        </div>
    )
}