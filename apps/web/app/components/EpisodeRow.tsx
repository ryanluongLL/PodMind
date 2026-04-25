'use client'

import { Heart, Sparkles, ExternalLink } from "lucide-react"
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Episode, toggleFavorite, transcribeEpisode } from "@/lib/api";
import styles from './EpisodeRow.module.css'

// Single row in the episode list. Owns three actions:
//   - Toggle favorite (pins to top of the list)
//   - Trigger transcription (kicks off the Whisper + embedding job)
//   - Open the original episode page in a new tab
//
// After any mutation, invalidate the parent's React Query cache so the list re-fetches and reflects the new state (e.g. favorited episode jumps up, transcript badge appears)

export function EpisodeRow({ episode }: { episode: Episode }) {
    const queryClient = useQueryClient()

    ///mutation for the heart button. Sends the *opposite* of the current state
    const favoriteMutation = useMutation({
        mutationFn: () => toggleFavorite(episode.id, !episode.is_favorite),
        onSuccess: () => {
             // invalidating tells React Query "this data is stale, refetch it" — the episodeRow gets re-rendered with the new is_favorite value
            queryClient.invalidateQueries({queryKey: ['podcast', episode.podcast_id]})
        }
    })

    // Mutation for the sparkles button. The API enqueues a background job; the response comes back instantly even though transcription takes 1-3 minutes.
    // The badge will update from "Transcribing..." to "Transcript ready" once the worker finishes and the user refreshes the page
    const transcribeMutation = useMutation({
        mutationFn: () => transcribeEpisode(episode.id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['podcast', episode.podcast_id]})
        }
    })

    ///format the date
    let dateStr;
    if (episode.published_at) {
        dateStr = new Date(episode.published_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    } else {
        dateStr = '';
    }

    return (
        <div className={styles.row}>
            <div className={styles.iconWrapper}>
                {episode.icon_url && (
                    <img src={episode.icon_url} alt="" className={styles.icon} />
                )}
            </div>

            <div className={styles.content}>
                <h3 className={styles.title}>{episode.title}</h3>
                <div className={styles.meta}>
                    <span>{dateStr}</span>
                    {/* Conditional badges based on the transcript pipeline state */}
                    {episode.transcript_status === 'done' && (
                        <span className={styles.transcriptBadge}>
                            <Sparkles size={12} />
                            Transcript ready
                        </span>
                    )}
                    {episode.transcript_status === 'processing' && (
                        <span className={styles.processingBadge}>Transcribing...</span>
                    )}
                </div>
            </div>

            <div className={styles.actions}>
                {/* Only show the transcribe button if there's no transcript yet */}
                {!episode.transcript_status && (
                    <button
                        onClick={() => transcribeMutation.mutate()}
                        disabled={transcribeMutation.isPending}
                        className={styles.transcribeBtn}
                        title="Transcribe episode"
                    >
                        <Sparkles size={16} />
                    </button>
                )}
                {episode.episode_url && episode.episode_url.startsWith('http') &&(
                    <a
                        href={episode.episode_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkBtn}
                        title="Open on Podbean"
                    >
                        <ExternalLink size={16} />
                    </a>
                )}
                {/* The favorite button toggles styles via a conditional class */}
                <button
                    onClick={() => favoriteMutation.mutate()}
                    className={`${styles.favoriteBtn} ${episode.is_favorite ? styles.favoriteActive : ''}`}
                    title={episode.is_favorite ? 'Remove favorite' : 'Add favorite'}
                >
                    <Heart size={16} fill={episode.is_favorite ? 'currentColor' : 'none'} />
                </button>

            </div>
        </div>
    )

}