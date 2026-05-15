'use client'

import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, Sparkles } from 'lucide-react'
import { getVocabulary, deleteWord } from '@/lib/api'
import styles from './page.module.css'

// Vocabulary deck page — shows all saved words with their translations,
// context sentences, and source episodes. Tapping a word will eventually
// jump to the audio at that timestamp (coming with the review feature).
export default function VocabularyPage() {
  const queryClient = useQueryClient()

  const { data: words, isLoading } = useQuery({
    queryKey: ['vocabulary'],
    queryFn: getVocabulary,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
    },
  })

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Vocabulary</h1>
          <p className={styles.subtitle}>
            {words?.length ?? 0} words saved from your podcasts
          </p>
        </div>
        <Link href="/review" className={styles.reviewBtn}>
          <Sparkles size={16} />
          Start review
        </Link>
      </div>

      {isLoading && <div className={styles.loading}>Loading...</div>}

      {words && words.length === 0 && (
        <div className={styles.empty}>
          <p>No words saved yet.</p>
          <p className={styles.emptyHint}>
            Click any word in a transcript to translate and save it.
          </p>
        </div>
      )}

      <div className={styles.wordList}>
        {words?.map((item) => (
          <div key={item.id} className={styles.wordCard}>
            <div className={styles.wordHeader}>
              <div>
                <span className={styles.word}>{item.word}</span>
                <span className={styles.translation}>{item.translation}</span>
              </div>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                className={styles.deleteBtn}
                title="Remove word"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <p className={styles.context}>
              &ldquo;{item.context_sentence}&rdquo;
            </p>
            <div className={styles.meta}>
              <span className={styles.reviewBadge}>
                Review in {item.interval_days} {item.interval_days === 1 ? 'day' : 'days'}
              </span>
              <span className={styles.reviewCount}>
                {item.review_count} reviews
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}