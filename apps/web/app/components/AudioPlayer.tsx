'use client'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { usePlayer } from '@/lib/playerStore'
import styles from './AudioPlayer.module.css'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioPlayer() {
  const { nowPlaying, isPlaying, currentTime, togglePlayPause, seekTo, audioRef } = usePlayer()
  const [speed, setSpeed] = useState(1)

  if (!nowPlaying) return null

  const duration = audioRef.current?.duration ?? 0
  const progress = duration ? (currentTime / duration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seekTo(pct * duration)
  }

  const handleSpeedChange = () => {
    const currentIdx = SPEEDS.indexOf(speed)
    const nextSpeed = SPEEDS[(currentIdx + 1) % SPEEDS.length] ?? 1
    setSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  const activeSegment = nowPlaying.segments.findIndex(
    (s) => currentTime >= s.start && currentTime < s.end
  )

  return (
    <div className={styles.bar}>
      <div className={styles.progressTrack} onClick={handleProgressClick}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.content}>
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

        <div className={styles.right}>
          {/* Speed control — cycles through speeds on click */}
          <button onClick={handleSpeedChange} className={styles.speedBtn} title="Playback speed">
            {speed}x
          </button>
          <div className={styles.time}>
            <span>{formatTime(currentTime)}</span>
            <span className={styles.timeSep}>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {activeSegment !== -1 && nowPlaying.segments[activeSegment] && (
        <div className={styles.liveCaption}>
          &ldquo;{nowPlaying.segments[activeSegment]?.text}&rdquo;
        </div>
      )}
    </div>
  )
}