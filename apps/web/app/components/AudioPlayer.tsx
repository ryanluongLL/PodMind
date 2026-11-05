"use client"

import { useState } from "react"
import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { usePlayer } from "@/lib/playerStore"
import styles from "./AudioPlayer.module.css"

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/// Persistent bottom player. Duration and current time come from the player
/// context as state, so the bar re-renders whenever either one changes.
export function AudioPlayer() {
  const { nowPlaying, isPlaying, currentTime, duration, togglePlayPause, seekTo, audioRef } =
    usePlayer()
  const [speed, setSpeed] = useState(1)

  if (!nowPlaying) {
    return null
  }

  let progress = 0
  if (duration > 0) {
    progress = (currentTime / duration) * 100
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) {
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seekTo(pct * duration)
  }

  /// Sets both rates. Loading a new episode resets playbackRate to
  /// defaultPlaybackRate, so setting the default too keeps the chosen speed
  /// when the next episode starts.
  const handleSpeedChange = () => {
    const currentIdx = SPEEDS.indexOf(speed)
    const nextSpeed = SPEEDS[(currentIdx + 1) % SPEEDS.length] ?? 1
    setSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
      audioRef.current.defaultPlaybackRate = nextSpeed
    }
  }

  const activeSegment = nowPlaying.segments.findIndex(
    (s) => currentTime >= s.start && currentTime < s.end
  )
  const caption = activeSegment !== -1 ? nowPlaying.segments[activeSegment] : undefined

  return (
    <div className={styles.bar}>
      <div
        className={styles.progressTrack}
        onClick={handleProgressClick}
        role="progressbar"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
      >
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
            title="Back 15 seconds"
            aria-label="Back 15 seconds"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlayPause}
            className={styles.playBtn}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>

          <button
            onClick={() => seekTo(Math.min(duration, currentTime + 30))}
            className={styles.controlBtn}
            title="Forward 30 seconds"
            aria-label="Forward 30 seconds"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div className={styles.right}>
          <button
            onClick={handleSpeedChange}
            className={styles.speedBtn}
            title="Playback speed"
            aria-label={`Playback speed ${speed}x`}
          >
            {speed}x
          </button>
          <div className={styles.time}>
            <span>{formatTime(currentTime)}</span>
            <span className={styles.timeSep}>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {caption && <div className={styles.liveCaption}>&ldquo;{caption.text}&rdquo;</div>}
    </div>
  )
}