"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle } from "lucide-react"
import {
  useWords,
  getDueWords,
  reviewWord,
  previewInterval,
  type SavedWord,
  type ReviewRating,
} from "@/lib/localStore"
import styles from "./page.module.css"

const RATINGS: { rating: ReviewRating; name: string; style: string }[] = [
  { rating: 1, name: "Again", style: "ratingAgain" },
  { rating: 2, name: "Hard", style: "ratingHard" },
  { rating: 3, name: "Good", style: "ratingGood" },
  { rating: 4, name: "Easy", style: "ratingEasy" },
]

function formatInterval(days: number): string {
  if (days === 1) {
    return "1 day"
  }
  if (days < 30) {
    return `${days} days`
  }
  const months = Math.round(days / 30)
  if (months === 1) {
    return "1 month"
  }
  return `${months} months`
}

/// Flashcard review with SM-2 scheduling, all in the browser.
export default function ReviewPage() {
  const words = useWords()
  const [queue, setQueue] = useState<SavedWord[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  /// Snapshot the due words once, the first time localStorage is readable
  /// (words is undefined during server rendering). Rating a word moves its
  /// next review date into the future, so re-reading the due list mid session
  /// would shrink it and skip cards. Setting state during render is safe here
  /// because queue stops being null after the first run.
  if (queue === null && words !== undefined) {
    setQueue(getDueWords())
  }

  const current = queue ? queue[index] : undefined

  const rate = (rating: ReviewRating) => {
    if (!current) {
      return
    }
    reviewWord(current.id, rating)
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  /// Keyboard: Space or Enter flips the card, 1 to 4 rates it once flipped.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!current) {
        return
      }
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault()
        setFlipped(true)
        return
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        rate(Number(e.key) as ReviewRating)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  })

  if (queue === null) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>Loading your review session...</div>
      </main>
    )
  }

  if (queue.length === 0 || !current) {
    const finished = queue.length > 0
    return (
      <main className={styles.main}>
        <div className={styles.complete}>
          <CheckCircle size={48} className={styles.completeIcon} />
          <h2 className={styles.completeTitle}>
            {finished ? "Session complete" : "Nothing to review"}
          </h2>
          <p className={styles.completeSubtitle}>
            {finished
              ? `You reviewed ${queue.length} ${queue.length === 1 ? "word" : "words"}. Come back tomorrow for the next ones.`
              : "All your words are up to date. Save new words from a transcript, or come back tomorrow."}
          </p>
          <div className={styles.completeActions}>
            <Link href="/vocabulary" className={styles.primaryBtn}>
              View vocabulary
            </Link>
            <Link href="/" className={styles.secondaryBtn}>
              Back to library
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.topBar}>
        <Link href="/vocabulary" className={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
        <div className={styles.progress}>
          <div
            className={styles.progressFill}
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className={styles.progressLabel}>
          {index + 1} of {queue.length}
        </span>
      </div>

      <div className={styles.cardArea}>
        {/* A new key per word mounts a fresh face down card, so the next
            answer is never visible during the flip back animation */}
        <div
          key={current.id}
          className={`${styles.card} ${flipped ? styles.cardFlipped : ""}`}
          onClick={() => setFlipped(true)}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Answer shown" : "Show answer"}
        >
          <div className={styles.cardFront}>
            <p className={styles.cardHint}>What does this mean?</p>
            <h2 className={styles.cardWord}>{current.word}</h2>
            <p className={styles.cardTap}>Click or press Space to reveal</p>
          </div>

          <div className={styles.cardBack}>
            <h2 className={styles.cardWord}>{current.word}</h2>
            <p className={styles.cardTranslation}>{current.translation}</p>
            <p className={styles.cardContext}>&ldquo;{current.contextSentence}&rdquo;</p>
          </div>
        </div>

        {flipped ? (
          <div className={styles.ratingSection}>
            <p className={styles.ratingLabel}>How well did you remember it?</p>
            <div className={styles.ratingBtns}>
              {RATINGS.map((r) => (
                <button
                  key={r.rating}
                  onClick={() => rate(r.rating)}
                  className={`${styles.ratingBtn} ${styles[r.style]}`}
                >
                  <span className={styles.ratingName}>
                    {r.rating}. {r.name}
                  </span>
                  <span className={styles.ratingInterval}>
                    {formatInterval(previewInterval(current, r.rating))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.flipHint}>Try to remember the meaning before you flip.</p>
        )}
      </div>
    </main>
  )
}