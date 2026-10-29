"use client"

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react"
import { api } from "./api"
import { recordActivity } from "./localStore"

interface Segment {
  start: number
  end: number
  text: string
}

interface NowPlaying {
  episodeId: string
  episodeTitle: string
  podcastName: string
  audioUrl: string
  iconUrl: string | null
  segments: Segment[]
}

interface PlayerContextType {
  nowPlaying: NowPlaying | null
  isPlaying: boolean
  currentTime: number
  play: (episode: NowPlaying) => void
  togglePlayPause: () => void
  seekTo: (time: number) => void
  audioRef: RefObject<HTMLAudioElement | null>
}

/// Audio that finished loading, plus the exact play request it belongs to.
/// Comparing against the current request (not just the episode id) means
/// replaying the same episode never reuses a URL that was already released.
interface LoadedAudio {
  request: NowPlaying
  url: string
}

const PlayerContext = createContext<PlayerContextType | null>(null)

/// Wraps the whole app so the audio element survives page navigation.
/// The bottom player bar reads from this context.
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadedAudio, setLoadedAudio] = useState<LoadedAudio | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listenStartRef = useRef<number | null>(null)

  const play = useCallback((episode: NowPlaying) => {
    setNowPlaying(episode)
    setIsPlaying(true)
    setCurrentTime(0)
  }, [])

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) {
      return
    }
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying((p) => !p)
  }, [isPlaying])

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) {
      return
    }
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  /// Loads the cached MP3 that Whisper transcribed, so timestamps line up.
  /// The original RSS URL can have different ads inserted each time, which
  /// shifts the audio and breaks transcript sync, so it is only a fallback.
  /// State is only set after the download finishes, never directly in the
  /// effect body.
  useEffect(() => {
    if (!nowPlaying) {
      return
    }

    const request = nowPlaying
    let cancelled = false
    let createdUrl: string | null = null

    const loadAudio = async () => {
      try {
        const res = await api.get(`/audio/${request.episodeId}`, {
          responseType: "blob",
        })
        if (cancelled) {
          return
        }
        createdUrl = URL.createObjectURL(res.data)
        setLoadedAudio({ request, url: createdUrl })
      } catch {
        if (!cancelled) {
          setLoadedAudio({ request, url: request.audioUrl })
        }
      }
    }

    loadAudio()

    return () => {
      cancelled = true
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [nowPlaying])

  /// Calculated during render instead of stored: only use loaded audio if it
  /// belongs to what is playing right now. Stopping or switching episodes
  /// needs no extra state update, and old audio never plays by mistake.
  let audioSrc: string | undefined = undefined
  if (nowPlaying !== null && loadedAudio !== null && loadedAudio.request === nowPlaying) {
    audioSrc = loadedAudio.url
  }

  /// Saves how long the learner just listened. Counts toward the daily goal
  /// and keeps the streak alive.
  const saveListeningTime = () => {
    if (listenStartRef.current === null) {
      return
    }
    const minutes = (Date.now() - listenStartRef.current) / 60000
    listenStartRef.current = null
    if (minutes > 0.05) {
      recordActivity(minutes)
    }
  }

  return (
    <PlayerContext.Provider
      value={{ nowPlaying, isPlaying, currentTime, play, togglePlayPause, seekTo, audioRef }}
    >
      {children}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => {
          setIsPlaying(true)
          listenStartRef.current = Date.now()
        }}
        onPause={() => {
          setIsPlaying(false)
          saveListeningTime()
        }}
        onEnded={() => {
          setIsPlaying(false)
          saveListeningTime()
        }}
        autoPlay={audioSrc !== undefined}
      />
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider")
  }
  return ctx
}