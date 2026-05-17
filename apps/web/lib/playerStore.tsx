'use client'
import { createContext, useContext, useState, useRef, useCallback, type ReactNode, type RefObject, useEffect } from 'react'
import { api, logListening } from './api'

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

const PlayerContext = createContext<PlayerContextType | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const listenStartRef = useRef<number | null>(null)  // ← must be inside the component

  const play = useCallback((episode: NowPlaying) => {
    setNowPlaying(episode)
    setIsPlaying(true)
    setCurrentTime(0)
  }, [])

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying((p) => !p)
  }, [isPlaying])

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  useEffect(() => {
    if (!nowPlaying) {
      setAudioBlobUrl(null)
      return
    }
    let cancelled = false
    let createdUrl: string | null = null

    const loadAudio = async () => {
      try {
        const res = await api.get(`/audio/${nowPlaying.episodeId}`, {
          responseType: 'blob',
        })
        if (cancelled) return
        createdUrl = URL.createObjectURL(res.data)
        setAudioBlobUrl(createdUrl)
      } catch (err) {
        console.error('Failed to load cached audio, falling back to original URL', err)
        if (!cancelled) setAudioBlobUrl(nowPlaying.audioUrl)
      }
    }

    loadAudio()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [nowPlaying])

  // Helper to log listening time when audio stops
  const logListeningTime = () => {
    if (listenStartRef.current) {
      const minutes = (Date.now() - listenStartRef.current) / 60000
      if (minutes > 0.1) logListening(Math.round(minutes))
      listenStartRef.current = null
    }
  }

  return (
    <PlayerContext.Provider value={{ nowPlaying, isPlaying, currentTime, play, togglePlayPause, seekTo, audioRef }}>
      {children}
      <audio
        ref={audioRef}
        src={audioBlobUrl ?? undefined}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => {
          setIsPlaying(true)
          listenStartRef.current = Date.now()
        }}
        onPause={() => {
          setIsPlaying(false)
          logListeningTime()
        }}
        onEnded={() => {
          setIsPlaying(false)
          logListeningTime()
        }}
        autoPlay={!!audioBlobUrl}
      />
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}