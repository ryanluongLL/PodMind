import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {type Podcast, deletePodcast} from '@/lib/api'
import styles from './PostcastCard.module.css'

export function PodcastCard({ podcast }: { podcast: Podcast }) {
    const [confirming, setConfirming] = useState(false)
    const queryClient = useQueryClient()

    const deleteMutation = useMutation({
        mutationFn: () => deletePodcast(podcast.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['podcasts']})
        },
    })

    ///two-step confirmation: first click shows confirm state, second click within 3s actually deletes
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirming) {
            deleteMutation.mutate()
        } else {
            setConfirming(true)
            setTimeout(() => setConfirming(false), 3000)
        }
    }
    return (
        <Link href={`/podcast/${podcast.id}`} className={styles.card}>
            <button
                onClick={handleDelete}
                className={`${styles.deleteBtn} ${confirming ? styles.deleteBtnConfirm : ''}`}
                title={confirming ? 'Click again to confirm' : 'Delete podcast'}
            >
                <Trash2 size={16} />
            </button>
            
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