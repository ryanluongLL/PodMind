"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { usePlayer } from "@/lib/playerStore"
import { type Episode, type ExampleSentence, translateWord } from "@/lib/api"
import { useProfile, useWords, saveWord } from "@/lib/localStore"
import { TranslationPopup } from "./TranslationPopup"
import styles from "./TranscriptViewer.module.css"

interface PopupState {
  word: string
  context: string
  segmentIndex: number
  wordIndex: number
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
  const profile = useProfile()
  const words = useWords()
  const activeRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)

  const segments = episode.transcript_segments ?? []
  const isThisEpisodePlaying = nowPlaying?.episodeId === episode.id

  let activeIndex = -1
  if (isThisEpisodePlaying) {
    activeIndex = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end)
  }

  const { data: translationResult, isLoading: isTranslating } = useQuery({
    queryKey: ["translation", popup?.word, popup?.context, profile?.nativeLanguage],
    queryFn: () =>
      translateWord(popup!.word, profile!.nativeLanguage, popup!.context, episode.id),
    enabled: popup !== null && profile !== undefined,
  })

  /// Saved status comes from the learner's real vocabulary, so a word saved
  /// in an earlier session still shows as saved.
  let isSaved = false
  if (popup && words) {
    isSaved = words.some((w) => w.word === popup.word)
  }

  /// Keep the line being spoken centered on screen
  useEffect(() => {
    if (activeRef.current && activeIndex !== -1) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [activeIndex])

  const seekInThisEpisode = (start: number) => {
    const seekTime = start + 0.05
    if (isThisEpisodePlaying) {
      seekTo(seekTime)
      return
    }
    if (!episode.audio_url) {
      return
    }
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

  /// Plays the moment an example sentence was spoken. Examples from this
  /// episode just seek; examples from other episodes start that episode first.
  const handleExampleClick = (example: ExampleSentence) => {
    setPopup(null)

    if (example.episodeId === episode.id) {
      seekInThisEpisode(example.start)
      return
    }
    if (!example.audioUrl) {
      return
    }
    play({
      episodeId: example.episodeId,
      episodeTitle: example.episodeTitle,
      podcastName: example.podcastName,
      audioUrl: example.audioUrl,
      iconUrl: example.iconUrl,
      segments: [],
    })
    setTimeout(() => seekTo(example.start + 0.05), 200)
  }

  const handleWordClick = (
    e: React.MouseEvent,
    word: string,
    context: string,
    segmentIndex: number,
    wordIndex: number
  ) => {
    /// Stop the click from reaching the line, which would seek the audio
    e.stopPropagation()
    const clean = word.replace(/[^a-zA-Z'-]/g, "")
    if (clean.length < 2) {
      return
    }
    setPopup({
      word: clean.toLowerCase(),
      context,
      segmentIndex,
      wordIndex,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  const handleSaveWord = () => {
    if (!popup || !translationResult) {
      return
    }
    saveWord({
      word: popup.word,
      translation: translationResult.translation,
      contextSentence: popup.context,
      episodeId: episode.id,
      timestampSeconds: segments[popup.segmentIndex]?.start ?? 0,
    })
  }

  return (
    <div className={styles.viewer}>
      <p className={styles.hint}>Click a word to look it up. Click a line to jump there.</p>

      {segments.map((segment, i) => {
        let segmentClass = styles.segment
        if (i === activeIndex) {
          segmentClass = `${styles.segment} ${styles.segmentActive}`
        }

        return (
          <div
            key={i}
            ref={i === activeIndex ? activeRef : null}
            onClick={() => seekInThisEpisode(segment.start)}
            className={segmentClass}
          >
            {segment.text.split(" ").map((word, j) => {
              let wordClass = styles.word
              if (popup && popup.segmentIndex === i && popup.wordIndex === j) {
                wordClass = `${styles.word} ${styles.wordActive}`
              }
              return (
                <span
                  key={j}
                  onClick={(e) => handleWordClick(e, word, segment.text, i, j)}
                  className={wordClass}
                >
                  {word}{" "}
                </span>
              )
            })}
          </div>
        )
      })}

      {popup && (
        <TranslationPopup
          word={popup.word}
          position={popup.position}
          result={translationResult ?? null}
          isLoading={isTranslating}
          onSave={handleSaveWord}
          onClose={() => setPopup(null)}
          onExampleClick={handleExampleClick}
          isSaved={isSaved}
          isSaving={false}
        />
      )}
    </div>
  )
}