'use client'

import { Play, Heart, Check, FileText, ExternalLink, ChevronDown, BarChart2 } from 'lucide-react'
import { usePlayer } from '@/lib/playerStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Episode, toggleFavorite, transcribeEpisode, rateEpisodeDifficulty } from '@/lib/api'
import { useState, useEffect } from 'react'
import styles from './EpisodeRow.module.css'
import { TranscriptViewer } from './TranscriptViewer'
import { DifficultyBadge } from './DifficultyBadge'

// Shows an estimated progress percentage while an episode is transcribing.
// Short episodes finish faster than we can poll real progress, so this
// climbs on a timer and never reaches 100 on its own. When the backend
// flips the status to done, this component unmounts and the
// "Transcript ready" pill takes its place.
function TranscribingBadge({ podcastId }: { podcastId: string }) {
  const [estimate, setEstimate] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    const interval = setInterval(() => {
      setEstimate((p) => {
        if (p < 90) {
          return p + Math.random() * 3
        }
        if (p < 98) {
          return p + 0.2
        }
        return p
      })
    }, 800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['podcast', podcastId] })
    }, 3000)
    return () => clearInterval(poll)
  }, [queryClient, podcastId])

  const pct = Math.min(Math.floor(estimate), 98)

  let label = 'Generating embeddings'
  if (pct < 20) {
    label = 'Downloading audio'
  } else if (pct < 40) {
    label = 'Compressing audio'
  } else if (pct < 65) {
    label = 'Transcribing'
  }

  return (
    <span className={styles.processingBadge}>
      <span className={styles.processingDot} />
      {label}... <strong className={styles.progressNum}>{pct}%</strong>
    </span>
  )
}

export function EpisodeRow({ episode, podcastName }: { episode: Episode; podcastName: string }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const { play } = usePlayer()

  const favoriteMutation = useMutation({
    mutationFn: () => toggleFavorite(episode.id, !episode.is_favorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcast', episode.podcast_id] })
    },
  })

  const transcribeMutation = useMutation({
    mutationFn: () => transcribeEpisode(episode.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcast', episode.podcast_id] })
    },
  })

  const difficultyMutation = useMutation({
    mutationFn: () => rateEpisodeDifficulty(episode.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['podcast', episode.podcast_id] })
    },
  })

  const handlePlay = () => {
    if (!episode.audio_url) {
      return
    }
    play({
      episodeId: episode.id,
      episodeTitle: episode.title,
      podcastName,
      audioUrl: episode.audio_url,
      iconUrl: episode.icon_url,
      segments: episode.transcript_segments ?? [],
    })
  }

  let dateStr = ''
  if (episode.published_at) {
    dateStr = new Date(episode.published_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasTranscript =
    episode.transcript_status === 'done' && (episode.transcript_segments?.length ?? 0) > 0

  const isProcessing =
    episode.transcript_status === 'processing' || episode.transcript_status === 'pending'

  return (
    <div className={`${styles.rowWrapper} ${expanded ? styles.rowExpanded : ''}`}>
      <div className={styles.row}>
        <button
          onClick={() => {
            if (hasTranscript) {
              setExpanded((e) => !e)
            }
          }}
          className={`${styles.chevronBtn} ${expanded ? styles.chevronOpen : ''}`}
          disabled={!hasTranscript}
          aria-label={hasTranscript ? 'Show transcript' : 'No transcript yet'}
          aria-expanded={expanded}
        >
          <ChevronDown size={16} />
        </button>

        <div className={styles.iconWrapper}>
          {episode.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={episode.icon_url} alt="" className={styles.icon} />
          )}
        </div>

        <div className={styles.content}>
          <h3 className={styles.title}>{episode.title}</h3>
          <div className={styles.meta}>
            <span>{dateStr}</span>
            {episode.difficulty && <DifficultyBadge level={episode.difficulty} />}
            {episode.transcript_status === 'done' && (
              <span className={styles.transcriptBadge}>
                <Check size={12} strokeWidth={2.5} />
                Transcript ready
              </span>
            )}
            {isProcessing && <TranscribingBadge podcastId={episode.podcast_id} />}
          </div>
        </div>

        <div className={styles.actions}>
          {episode.audio_url && (
            <button onClick={handlePlay} className={styles.transcribeBtn} title="Play episode">
              <Play size={16} fill="currentColor" />
            </button>
          )}

          {episode.transcript_status === 'done' && !episode.difficulty && (
            <button
              onClick={() => difficultyMutation.mutate()}
              disabled={difficultyMutation.isPending}
              className={styles.transcribeBtn}
              title="Rate difficulty"
            >
              <BarChart2 size={16} />
            </button>
          )}

          {!episode.transcript_status && (
            <button
              onClick={() => transcribeMutation.mutate()}
              disabled={transcribeMutation.isPending}
              className={styles.transcribeBtn}
              title="Transcribe episode"
            >
              <FileText size={16} />
            </button>
          )}

          {episode.episode_url && episode.episode_url.startsWith('http') && (
            <a
              href={episode.episode_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
              title="Open original episode"
            >
              <ExternalLink size={16} />
            </a>
          )}

          <button
            onClick={() => favoriteMutation.mutate()}
            className={`${styles.favoriteBtn} ${episode.is_favorite ? styles.favoriteActive : ''}`}
            title={episode.is_favorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Heart size={16} fill={episode.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {expanded && hasTranscript && <TranscriptViewer episode={episode} podcastName={podcastName} />}
    </div>
  )
}