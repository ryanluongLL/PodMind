'use client'

import { useEffect, useRef } from "react"
import { usePlayer } from "@/lib/playerStore"
import { type Episode } from '@/lib/api'
import styles from './TranscriptViewer.module.css'

export function TranscriptViewer({
    episode,
    podcastName,
}: {
        episode: Episode
        podcastName:string
    }) {
    const { nowPlaying, currentTime, play, seekTo } = usePlayer()
    const containerRef = useRef<HTMLDivElement>(null)
    const activeRef = useRef<HTMLButtonElement>(null)

    const segments = episode.transcript_segments ?? []
    const isThisEpisodePlaying = nowPlaying?.episodeId === episode.id

    ///find which segment is currently being spoken
    const activeIndex = isThisEpisodePlaying
        ? segments.findIndex((s) => currentTime >= s.start && currentTime < s.end)
        : -1
    
    // Auto-scroll to keep the active segment vertically centered.
    // We scroll the *page*, not just an internal container, so the user can also see the audio player at the bottom.
    useEffect(() => {
        if (activeRef.current && activeIndex !== -1) {
            activeRef.current.scrollIntoView({behavior: 'smooth', block:'center'})
        }
    }, [activeIndex])

    const handleSegmentClick = (segmentStart: number) => {
        if (isThisEpisodePlaying) {
            ///already playing this episode - just seek
            seekTo(segmentStart)
        } else {
            ///different episode (or nothing playing) - start this one and seek
            if (!episode.audio_url) return
            play({
                episodeId: episode.id,
                episodeTitle: episode.title,
                podcastName,
                audioUrl: episode.audio_url,
                iconUrl: episode.icon_url,
                segments,
            })
            ///slight delay so audio element has time to load before seeking
            setTimeout(() => seekTo(segmentStart), 200)
        }
    }

    return (
        <div ref={containerRef} className={styles.viewer}>
            {segments.map((segment, i) => (
                <button
                    key={i}
                    ref={i === activeIndex ? activeRef : null}
                    onClick={() => handleSegmentClick(segment.start)}
                    className={`${styles.segment} ${i === activeIndex ? styles.segmentActive : ''}`}
                >
                    {segment.text}
                </button>
            ))}
        </div>
    )
}