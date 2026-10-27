'use client'

import { useEffect, useRef } from 'react'
import { BookMarked, Check, Loader2, Play, X } from 'lucide-react'
import type { ExampleSentence, TranslationResult, WordRarity } from '@/lib/api'
import styles from './TranslationPopup.module.css'

interface Props {
  word: string
  position: { x: number; y: number }
  result: TranslationResult | null
  isLoading: boolean
  onSave: () => void
  onClose: () => void
  onExampleClick: (example: ExampleSentence) => void
  isSaved: boolean
  isSaving: boolean
}

const POPUP_WIDTH = 320
const POPUP_HEIGHT_ESTIMATE = 460

const RARITY_LEVEL: Record<WordRarity['band'], number> = {
  'very common': 4,
  common: 3,
  'less common': 2,
  rare: 1,
}

const RARITY_NAME: Record<WordRarity['band'], string> = {
  'very common': 'Very common',
  common: 'Common',
  'less common': 'Less common',
  rare: 'Rare',
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Wraps every form of the looked up word in a highlighter mark, so
// "disciple group" lights up "disciple" when the learner clicked "disciples".
function renderHighlighted(text: string, word: string, lemma: string) {
  const base = lemma.length > 0 ? lemma : word
  const pattern = new RegExp(`\\b(${escapeRegex(word)}|${escapeRegex(base)}[a-z]*)\\b`, 'gi')
  const parts = text.split(pattern)

  return parts.map((part, i) => {
    // With one capture group, split puts matches at odd indexes
    if (i % 2 === 1) {
      return (
        <mark key={i} className={styles.mark}>
          {part}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function RarityMeter({ rarity }: { rarity: WordRarity }) {
  const level = RARITY_LEVEL[rarity.band]
  const name = RARITY_NAME[rarity.band]

  const bars = []
  for (let i = 1; i <= 4; i++) {
    let className = styles.bar
    if (i <= level) {
      className = `${styles.bar} ${styles.barOn}`
    }
    bars.push(<span key={i} className={className} />)
  }

  return (
    <span className={styles.rarity} aria-label={`Word frequency: ${name}`}>
      <span className={styles.bars} aria-hidden="true">
        {bars}
      </span>
      {name}
    </span>
  )
}

// Floating word lookup card. Opens near the clicked word, flips above it when
// there isn't room below, and closes on outside click or Escape.
export function TranslationPopup({
  word,
  position,
  result,
  isLoading,
  onSave,
  onClose,
  onExampleClick,
  isSaved,
  isSaving,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  let top = position.y + 14
  if (position.y + POPUP_HEIGHT_ESTIMATE > window.innerHeight) {
    top = Math.max(8, position.y - POPUP_HEIGHT_ESTIMATE)
  }
  const left = Math.min(Math.max(position.x - 120, 8), window.innerWidth - POPUP_WIDTH - 8)

  const showLemma = result !== null && result.lemma.length > 0 && result.lemma !== word

  let saveLabel = 'Save to vocabulary'
  if (isSaving) {
    saveLabel = 'Saving...'
  } else if (isSaved) {
    saveLabel = 'Saved to vocabulary'
  }

  return (
    <div
      ref={ref}
      className={styles.popup}
      style={{ top, left }}
      role="dialog"
      aria-labelledby="word-popup-title"
    >
      <div className={styles.header}>
        <div>
          <h3 id="word-popup-title" className={styles.word}>
            {word}
          </h3>
          {showLemma && (
            <p className={styles.lemma}>
              from <em>{result.lemma}</em>
            </p>
          )}
        </div>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <Loader2 size={16} className={styles.spinner} />
          <span>Looking up...</span>
        </div>
      )}

      {result && !isLoading && (
        <>
          {result.translation && <p className={styles.translation}>{result.translation}</p>}

          <div className={styles.metaRow}>
            {result.partOfSpeech && <span className={styles.pos}>{result.partOfSpeech}</span>}
            <RarityMeter rarity={result.rarity} />
          </div>

          {result.definition && <p className={styles.definition}>{result.definition}</p>}
          <p className={styles.rarityNote}>{result.rarity.label}</p>

          {result.otherMeanings.length > 0 && (
            <details className={styles.other}>
              <summary className={styles.otherSummary}>
                Other meanings ({result.otherMeanings.length})
              </summary>
              <ol className={styles.otherList}>
                {result.otherMeanings.map((m, i) => (
                  <li key={i}>
                    {m.partOfSpeech && <span className={styles.otherPos}>{m.partOfSpeech}</span>}
                    {m.definition}
                  </li>
                ))}
              </ol>
            </details>
          )}

          {result.examples.length > 0 && (
            <section className={styles.examples}>
              <h4 className={styles.sectionLabel}>Heard in your podcasts</h4>
              <ul className={styles.exampleList}>
                {result.examples.map((ex, i) => (
                  <li key={i}>
                    <button className={styles.exampleBtn} onClick={() => onExampleClick(ex)}>
                      <span className={styles.exampleText}>
                        {renderHighlighted(ex.text, word, result.lemma)}
                      </span>
                      <span className={styles.exampleSource}>
                        <Play size={11} fill="currentColor" aria-hidden="true" />
                        <span className={styles.sourceTitle}>{ex.podcastName}</span>
                        <span className={styles.sourceTime}>{formatTime(ex.start)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            onClick={onSave}
            disabled={isSaved || isSaving}
            className={`${styles.saveBtn} ${isSaved ? styles.saveBtnSaved : ''}`}
          >
            {isSaved ? <Check size={15} /> : <BookMarked size={15} />}
            {saveLabel}
          </button>
        </>
      )}
    </div>
  )
}