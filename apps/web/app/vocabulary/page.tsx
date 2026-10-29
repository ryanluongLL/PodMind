"use client"

import Link from "next/link"
import { ArrowLeft, Trash2 } from "lucide-react"
import { useWords, deleteWord, dateKey } from "@/lib/localStore"
import styles from "./page.module.css"

/// Days from today until a YYYY-MM-DD date. Negative means overdue.
function daysUntil(target: string): number {
  const [ty, tm, td] = target.split("-").map(Number)
  const [ny, nm, nd] = dateKey().split("-").map(Number)
  const targetDate = new Date(ty ?? 1970, (tm ?? 1) - 1, td ?? 1)
  const today = new Date(ny ?? 1970, (nm ?? 1) - 1, nd ?? 1)
  return Math.round((targetDate.getTime() - today.getTime()) / 86400000)
}

function reviewLabel(nextReviewDate: string): string {
  const days = daysUntil(nextReviewDate)
  if (days <= 0) {
    return "Due now"
  }
  if (days === 1) {
    return "Review tomorrow"
  }
  return `Review in ${days} days`
}

/// The learner's saved words, newest first, with the sentence each one came from.
export default function VocabularyPage() {
  const words = useWords()

  let dueCount = 0
  if (words) {
    const today = dateKey()
    dueCount = words.filter((w) => w.nextReviewDate <= today).length
  }

  let content
  if (words === undefined) {
    content = <div className={styles.loading}>Loading...</div>
  } else if (words.length === 0) {
    content = (
      <div className={styles.empty}>
        <p>No words saved yet.</p>
        <p className={styles.emptyHint}>
          Open a transcript, click any word, and choose Save to vocabulary.
        </p>
      </div>
    )
  } else {
    content = (
      <div className={styles.wordList}>
        {words.map((item) => (
          <div key={item.id} className={styles.wordCard}>
            <div className={styles.wordHeader}>
              <div>
                <span className={styles.word}>{item.word}</span>
                <span className={styles.translation}>{item.translation}</span>
              </div>
              <button
                onClick={() => deleteWord(item.id)}
                className={styles.deleteBtn}
                title="Remove word"
                aria-label={`Remove ${item.word}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <p className={styles.context}>&ldquo;{item.contextSentence}&rdquo;</p>
            <div className={styles.meta}>
              <span className={styles.reviewBadge}>{reviewLabel(item.nextReviewDate)}</span>
              <span className={styles.reviewCount}>
                {item.reviewCount} {item.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Library</span>
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vocabulary</h1>
          <p className={styles.subtitle}>
            {words?.length ?? 0} words saved from your podcasts
          </p>
        </div>
        {dueCount > 0 && (
          <Link href="/review" className={styles.reviewBtn}>
            Review {dueCount} {dueCount === 1 ? "word" : "words"}
          </Link>
        )}
      </div>

      {content}
    </main>
  )
}