'use client'

import { Play, Heart, Sparkles, ExternalLink } from "lucide-react"
import { usePlayer } from "@/lib/playerStore";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Episode, toggleFavorite, transcribeEpisode } from "@/lib/api";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from './EpisodeRow.module.css'
import { TranscriptViewer } from "./TranscriptViewer";

// Single row in the episode list. Owns three actions:
//   - Toggle favorite (pins to top of the list)
//   - Trigger transcription (kicks off the Whisper + embedding job)
//   - Open the original episode page in a new tab
//
// After any mutation, invalidate the parent's React Query cache so the list re-fetches and reflects the new state (e.g. favorited episode jumps up, transcript badge appears)

export function EpisodeRow({ episode, podcastName }: { episode: Episode; podcastName:string }) {
    const queryClient = useQueryClient()
    const [expanded, setExpanded] = useState(false)

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

    const { play } = usePlayer()
    
    const handlePlay = () => {
        if (!episode.audio_url) return
        play({
            episodeId: episode.id,
            episodeTitle: episode.title,
            podcastName,
            audioUrl: episode.audio_url,
            iconUrl: episode.icon_url,
            segments: episode.transcript_segments ?? [],
        })
    }

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

    ///only let users expand if we have segments to show
    const hasTranscript = episode.transcript_status === 'done' && (episode.transcript_segments?.length ?? 0) > 0

    return (
        <div className={`${styles.rowWrapper} ${expanded ? styles.rowExpanded : ''}`}>
            <div className={styles.row}>
                {/* Chevron — only clickable if transcript exists */}
                <button
                    onClick={() => hasTranscript && setExpanded((e) => !e)}
                    className={`${styles.chevronBtn} ${expanded ? styles.chevronOpen : ''}`}
                    disabled={!hasTranscript}
                    title={hasTranscript ? 'Show transcript' : 'No transcript yet'}
                >
                    <ChevronDown size={16} />
                </button>
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
                    {episode.audio_url && (
                        <button
                            onClick={handlePlay}
                            className={styles.transcribeBtn}
                            title="Play episode"
                        >
                            <Play size={16} fill="currentColor" />
                        </button>
                    )}
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

            {/* Inline expanded transcript */}
            {expanded && hasTranscript && (
                <TranscriptViewer episode={episode} podcastName={podcastName} />
            )}
        </div>
        
        
    )

}