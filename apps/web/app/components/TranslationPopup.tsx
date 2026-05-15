'use client'

import { useEffect, useRef } from "react"
import { BookMarked, Loader2, X } from "lucide-react"
import type { TranslationResult } from "@/lib/api"
import styles from './TranslationPopup.module.css'
interface Props{
    word: string
    position: { x: number; y: number }
    result: TranslationResult | null
    isLoading: boolean
    onSave: () => void
    onClose: () => void
    isSaved: boolean
}

// Floating popup that appears when the user clicks a word in the transcript.
// Positioned near the clicked word using x/y coordinates from the click event.
// Closes when clicking outside or pressing Escape.
export function TranslationPopup({ word, position, result, isLoading, onSave, onClose, isSaved }: Props) {
    const ref = useRef<HTMLDivElement>(null)

    ///close when clicking outside the popup
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        const handleEsc = (e: KeyboardEvent) => {
            if(e.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', handleClick)
        document.addEventListener('keydown', handleEsc)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleEsc)
        }
    }, [onClose])

    ///keep popup within viewport bounds
    const style = {
        top: Math.min(position.y + 12, window.innerHeight - 300),
        left: Math.min(Math.max(position.x - 100, 8), window.innerWidth - 320),
    }

    return (
        <div ref={ref} className={styles.popup} style={style}>
        <div className={styles.header}>
            <span className={styles.word}>{word}</span>
            <button onClick={onClose} className={styles.closeBtn}>
            <X size={14} />
            </button>
        </div>

        {isLoading && (
            <div className={styles.loading}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Translating...</span>
            </div>
        )}

        {result && !isLoading && (
            <>
            <div className={styles.translation}>{result.translation}</div>

            {result.partOfSpeech && (
                <span className={styles.badge}>{result.partOfSpeech}</span>
            )}

            {result.definition && (
                <p className={styles.definition}>{result.definition}</p>
            )}

            {result.usageNote && (
                <p className={styles.usageNote}>
                <span className={styles.label}>Usage: </span>
                {result.usageNote}
                </p>
            )}

            {result.exampleSentence && (
                <p className={styles.example}>
                <span className={styles.label}>Example: </span>
                <em>{result.exampleSentence}</em>
                </p>
            )}

            <button
                onClick={onSave}
                disabled={isSaved}
                className={`${styles.saveBtn} ${isSaved ? styles.saveBtnSaved : ''}`}
            >
                <BookMarked size={14} />
                {isSaved ? 'Saved to vocabulary' : 'Save to vocabulary'}
            </button>
            </>
        )}
        </div>
    )
}