import Link from "next/link";
import type { Podcast } from '@/lib/api'
import styles from './PostcastCard.module.css'

export function PodcastCard({ podcast }: { podcast: Podcast }) {
    return (
        <Link href={`/podcast/${podcast.id}`} className={styles.card}>
            <div className={styles.coverWrapper}>
                {podcast.icon_url ? (
                    // eslint-disable-next-line @next/next-no-img-element
                    <img src={podcast.icon_url} alt={podcast.name} className={styles.cover} />
                ): (
                    <div className={styles.coverFallback}>🎙️</div>
                )}
            </div>
            <h3 className={styles.title}>{podcast.name}</h3>
            <p className={styles.episodeCount}>{podcast.episode_count} episodes</p>
        </Link>
    )
}