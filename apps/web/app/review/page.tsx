'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { getDueWords, reviewWord, type VocabularyWord } from '@/lib/api'
import styles from './page.module.css'

export default function ReviewPage() {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)
  const sessionTotalRef = useRef(0)

  const { data: dueWords, isLoading } = useQuery({
    queryKey: ['vocabulary-due'],
    queryFn: getDueWords,
    // Don't refetch during the session — stale data is fine here
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    console.log('dueWords changed:', dueWords?.length, 'ref:', sessionTotalRef.current)
    if (dueWords && dueWords.length > 0 && sessionTotalRef.current === 0) {
      sessionTotalRef.current = dueWords.length
      setSessionTotal(dueWords.length)
      console.log('Set sessionTotal to:', dueWords.length)
    }
  }, [dueWords])

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: 1 | 2 | 3 | 4 }) =>
      reviewWord(id, rating),
    onSuccess: () => {
      const nextIndex = currentIndex + 1
      const total = sessionTotalRef.current
      console.log('onSuccess - nextIndex:', nextIndex, 'total:', total)

      setTimeout(() => {
        if (nextIndex >= total) {
          setSessionDone(true)
          setReviewed((r) => r + 1)
          // Only invalidate when session is fully done
          queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
          queryClient.invalidateQueries({ queryKey: ['vocabulary-due'] })
        } else {
          setCurrentIndex(nextIndex)
          setFlipped(false)
          setReviewed((r) => r + 1)
          // Don't invalidate vocabulary-due mid-session
          queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
        }
      }, 600)
    },
  })

  const handleRate = (word: VocabularyWord, rating: 1 | 2 | 3 | 4) => {
    reviewMutation.mutate({ id: word.id, rating })
  }

  if (isLoading) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>Loading your review session...</div>
      </main>
    )
  }

  if (sessionDone) {
    return (
      <main className={styles.main}>
        <div className={styles.complete}>
          <CheckCircle size={48} className={styles.completeIcon} />
          <h2 className={styles.completeTitle}>Session complete!</h2>
          <p className={styles.completeSubtitle}>
            You reviewed {reviewed} word{reviewed === 1 ? '' : 's'} today. Great work!
          </p>
          <div className={styles.completeActions}>
            <Link href="/vocabulary" className={styles.primaryBtn}>View vocabulary</Link>
            <Link href="/" className={styles.secondaryBtn}>Back to home</Link>
          </div>
        </div>
      </main>
    )
  }

  if (sessionTotal === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.complete}>
          <CheckCircle size={48} className={styles.completeIcon} />
          <h2 className={styles.completeTitle}>Nothing to review!</h2>
          <p className={styles.completeSubtitle}>
            All your words are up to date. Come back tomorrow!
          </p>
          <div className={styles.completeActions}>
            <Link href="/vocabulary" className={styles.primaryBtn}>View vocabulary</Link>
            <Link href="/" className={styles.secondaryBtn}>Back to home</Link>
          </div>
        </div>
      </main>
    )
  }

  const current = dueWords?.[currentIndex]
  if (!current) {
    return (
      <main className={styles.main}>
        <div className={styles.complete}>
          <CheckCircle size={48} className={styles.completeIcon} />
          <h2 className={styles.completeTitle}>Session complete!</h2>
          <p className={styles.completeSubtitle}>
            You reviewed {reviewed} words today. Great work!
          </p>
          <div className={styles.completeActions}>
            <Link href="/vocabulary" className={styles.primaryBtn}>View vocabulary</Link>
            <Link href="/" className={styles.secondaryBtn}>Back to home</Link>
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
            style={{ width: `${(currentIndex / sessionTotal) * 100}%` }}
          />
        </div>
        <span className={styles.progressLabel}>
          {currentIndex + 1}/{sessionTotal}
        </span>
      </div>

      <div className={styles.cardArea}>
        <div
          className={`${styles.card} ${flipped ? styles.cardFlipped : ''}`}
          onClick={() => !flipped && setFlipped(true)}
        >
          <div className={styles.cardFront}>
            <p className={styles.cardHint}>What does this mean?</p>
            <h2 className={styles.cardWord}>{current.word}</h2>
            <p className={styles.cardTap}>Tap to reveal</p>
          </div>

          <div className={styles.cardBack}>
            <h2 className={styles.cardWord}>{current.word}</h2>
            <p className={styles.cardTranslation}>{current.translation}</p>
            <p className={styles.cardContext}>
              &ldquo;{current.context_sentence}&rdquo;
            </p>
          </div>
        </div>

        {flipped && (
          <div className={styles.ratingSection}>
            <p className={styles.ratingLabel}>How well did you remember?</p>
            <div className={styles.ratingBtns}>
              <button
                onClick={() => handleRate(current, 1)}
                disabled={reviewMutation.isPending}
                className={`${styles.ratingBtn} ${styles.ratingAgain}`}
              >
                <span className={styles.ratingEmoji}>😓</span>
                <span className={styles.ratingName}>Again</span>
                <span className={styles.ratingInterval}>Tomorrow</span>
              </button>
              <button
                onClick={() => handleRate(current, 2)}
                disabled={reviewMutation.isPending}
                className={`${styles.ratingBtn} ${styles.ratingHard}`}
              >
                <span className={styles.ratingEmoji}>🤔</span>
                <span className={styles.ratingName}>Hard</span>
                <span className={styles.ratingInterval}>3 days</span>
              </button>
              <button
                onClick={() => handleRate(current, 3)}
                disabled={reviewMutation.isPending}
                className={`${styles.ratingBtn} ${styles.ratingGood}`}
              >
                <span className={styles.ratingEmoji}>😊</span>
                <span className={styles.ratingName}>Good</span>
                <span className={styles.ratingInterval}>
                  {Math.ceil(current.interval_days * current.ease_factor)}d
                </span>
              </button>
              <button
                onClick={() => handleRate(current, 4)}
                disabled={reviewMutation.isPending}
                className={`${styles.ratingBtn} ${styles.ratingEasy}`}
              >
                <span className={styles.ratingEmoji}>🎉</span>
                <span className={styles.ratingName}>Easy</span>
                <span className={styles.ratingInterval}>
                  {Math.ceil(current.interval_days * current.ease_factor * 1.3)}d
                </span>
              </button>
            </div>
          </div>
        )}

        {!flipped && (
          <p className={styles.flipHint}>Click the card to see the answer</p>
        )}
      </div>
    </main>
  )
}