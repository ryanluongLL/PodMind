'use client'
import { createContext, useContext, useState, useRef, useCallback, type ReactNode, type RefObject, useEffect } from 'react'
import {api} from './api'
interface Segment{
    start: number
    end: number
    text:string
}

interface NowPlaying{
    episodeId: string
    episodeTitle: string
    podcastName: string
    audioUrl: string
    iconUrl: string | null
    segments: Segment[]
}

interface PlayerContextType{
    nowPlaying: NowPlaying | null
    isPlaying: boolean
    currentTime: number
    play: (episode: NowPlaying) => void
    togglePlayPause: () => void
    seekTo: (time: number) => void
      audioRef: RefObject<HTMLAudioElement | null>  // ← was React.RefObject

}

const PlayerContext = createContext<PlayerContextType | null>(null)

// Wraps the entire app — the audio element lives here so it persists across page navigations. The bottom bar reads from this context.

export function PlayerProvider({ children }: { children: ReactNode }) {
    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const play = useCallback((episode: NowPlaying) => {
        setNowPlaying(episode)
        setIsPlaying(true)
        setCurrentTime(0)
    }, [])

    const togglePlayPause = useCallback(() => {
        if (!audioRef.current) return
        if (isPlaying) audioRef.current.pause()
        else {
            audioRef.current.play()
        }
        setIsPlaying((p) => !p)
    }, [isPlaying])

    ///seek the audio to a specific timespamp in seconds
    const seekTo = useCallback((time: number) => {
        if (!audioRef.current) return
        audioRef.current.currentTime = time
        setCurrentTime(time)
    }, [])


    const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)

    ///when a new episode is played, fetch its cached audio with auth and create a blob URL the <audio> element can use.
    ///The dynamic ad-injected RSS URL would cause sync drift, so we always serve the same file Whisper transcribed

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
                ///fallback to the dynamic URL - sync may drift but at least playback works
                if (!cancelled) setAudioBlobUrl(nowPlaying.audioUrl)
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

    return (
        <PlayerContext.Provider value={{ nowPlaying, isPlaying, currentTime, play, togglePlayPause, seekTo, audioRef }}>
            {children}
            <audio
            ref={audioRef}
            src={audioBlobUrl ?? undefined}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
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