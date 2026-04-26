'use client'

import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { usePlayer } from '@/lib/playerStore'
import styles from './AudioPlayer.module.css'

///formats seconds into MM:SS display
function formatTime(seconds: number): string{
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2,'0')}`
}

// Persistent bottom player — only renders when something is playing. Progress bar is clickable to seek. Reads all state from PlayerContext.
export function AudioPlayer() {
    const { nowPlaying, isPlaying, currentTime, togglePlayPause, seekTo, audioRef } = usePlayer()
    if (!nowPlaying) return null
    
    const duration = audioRef.current?.duration ?? 0
    const progress = duration ? (currentTime / duration) * 100 : 0

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const pct = (e.clientX - rect.left) / rect.width
        seekTo(pct * duration)
    }

    ///find the currently active transcript segment based on playback position
    const activeSegment = nowPlaying.segments.findIndex(
        (s) => currentTime >= s.start && currentTime < s.end
    )
   return (
    <div className={styles.bar}>
      {/* Progress bar — click anywhere to seek */}
      <div className={styles.progressTrack} onClick={handleProgressClick}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.content}>
        {/* Episode info */}
        <div className={styles.info}>
          {nowPlaying.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nowPlaying.iconUrl} alt="" className={styles.cover} />
          )}
          <div className={styles.meta}>
            <p className={styles.episodeTitle}>{nowPlaying.episodeTitle}</p>
            <p className={styles.podcastName}>{nowPlaying.podcastName}</p>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button
            onClick={() => seekTo(Math.max(0, currentTime - 15))}
            className={styles.controlBtn}
            title="Back 15s"
          >
            <SkipBack size={20} />
          </button>

          <button onClick={togglePlayPause} className={styles.playBtn}>
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>

          <button
            onClick={() => seekTo(Math.min(duration, currentTime + 30))}
            className={styles.controlBtn}
            title="Forward 30s"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Time display */}
        <div className={styles.time}>
          <span>{formatTime(currentTime)}</span>
          <span className={styles.timeSep}>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Currently spoken segment — scrolls as audio plays */}
      {activeSegment !== -1 && nowPlaying.segments[activeSegment] && (
        <div className={styles.liveCaption}>
          &ldquo;{nowPlaying.segments[activeSegment]?.text}&rdquo;
        </div>
      )}
    </div>
  )
}