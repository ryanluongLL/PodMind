'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlayer } from '@/lib/playerStore'
import { type Episode, translateWord, getProfile } from '@/lib/api'
import { TranslationPopup } from './TranslationPopup'
import styles from './TranscriptViewer.module.css'

interface PopupState {
  word: string
  context: string
  position: { x: number; y: number }
}

export function TranscriptViewer({
  episode,
  podcastName,
}: {
  episode: Episode
  podcastName: string
}) {
  const { nowPlaying, currentTime, play, seekTo } = usePlayer()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set())

  const segments = episode.transcript_segments ?? []
  const isThisEpisodePlaying = nowPlaying?.episodeId === episode.id

  const activeIndex = isThisEpisodePlaying
    ? segments.findIndex((s) => currentTime >= s.start && currentTime < s.end)
    : -1

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })

  const { data: translationResult, isLoading: isTranslating } = useQuery({
    queryKey: ['translation', popup?.word, popup?.context],
    queryFn: () => translateWord(
      popup!.word,
      profile?.native_language ?? 'vi',
      popup!.context
    ),
    enabled: !!popup && !!profile,
  })

  useEffect(() => {
    if (activeRef.current && activeIndex !== -1) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIndex])

  const handleSegmentClick = (segmentStart: number) => {
    const seekTime = segmentStart + 0.05  // ← 50ms nudge past the boundary

    if (isThisEpisodePlaying) {
        seekTo(seekTime)
    } else {
        if (!episode.audio_url) return
        play({
        episodeId: episode.id,
        episodeTitle: episode.title,
        podcastName,
        audioUrl: episode.audio_url,
        iconUrl: episode.icon_url,
        segments,
        })
        setTimeout(() => seekTo(seekTime), 200)
    }
}

  const handleWordClick = (
    e: React.MouseEvent,
    word: string,
    context: string
  ) => {
    // Stop the click from bubbling up to the segment div (which would trigger seek)
    e.stopPropagation()
    const clean = word.replace(/[^a-zA-Z'-]/g, '')
    if (clean.length < 2) return
    setPopup({
      word: clean.toLowerCase(),
      context,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  const handleSaveWord = () => {
    if (!popup || !translationResult) return
    setSavedWords((prev) => new Set([...prev, popup.word]))
    // TODO: persist to vocabulary DB (next step)
  }

  return (
    <div ref={containerRef} className={styles.viewer}>
      <p className={styles.hint}>💡 Click any word to translate it</p>

      {segments.map((segment, i) => (
        // Clicking the div seeks audio — clicking a word span translates it
        <div
          key={i}
          ref={i === activeIndex ? activeRef : null}
          onClick={() => handleSegmentClick(segment.start)}
          className={`${styles.segment} ${i === activeIndex ? styles.segmentActive : ''}`}
        >
          {segment.text.split(' ').map((word, j) => (
            <span
              key={j}
              onClick={(e) => handleWordClick(e, word, segment.text)}
              className={styles.word}
            >
              {word}{' '}
            </span>
          ))}
        </div>
      ))}

      {popup && (
        <TranslationPopup
          word={popup.word}
          position={popup.position}
          result={translationResult ?? null}
          isLoading={isTranslating}
          onSave={handleSaveWord}
          onClose={() => setPopup(null)}
          isSaved={savedWords.has(popup.word)}
        />
      )}
    </div>
  )
}