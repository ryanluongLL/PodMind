'use client'

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Search as SearchIcon, Sparkles } from 'lucide-react'
import { searchTranscripts } from "@/lib/api"
import { SearchResultRow } from "@/app/components/SearchResultRow"
import styles from "./page.module.css"

///semantic search page
///only fires the query when the user actually submits (Enter or click)
///react query caches each unique query, so repeating a search is instant

export default function SearchPage() {
    const [input, setInput] = useState('')
    const [submittedQuery, setSubmittedQuery] = useState('')

    const { data: results, isLoading, isFetched } = useQuery({
        queryKey: ['search', submittedQuery],
        queryFn: () => searchTranscripts(submittedQuery),
        enabled: submittedQuery.length > 0, ///dont fire on mount
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if(input.trim()) setSubmittedQuery(input.trim())
    }
    
    return (
        <main className={styles.main}>
            <Link href="/" className={styles.backBtn}>
                <ArrowLeft size={16} />
                <span>Back</span>
            </Link>

            <div className={styles.hero}>
                <div className={styles.heroIcon}>
                    <Sparkles size={32} />
                </div>
                <h1 className={styles.title}>Semantic Search</h1>
                <p className={styles.tagline}>
                    Search your podcasts by meaning, not just keywords.
                </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.searchForm}>
                <SearchIcon size={20} className={styles.searchIcon} />
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder='Try "the nature of consciousness" or "how ideas spread'
                    className={styles.searchInput}
                    autoFocus
                />
                <button type="submit" className={styles.submitBtn}>
                    Search
                </button>
            </form>

            {/* three states: idle, loading, results */}
            {!submittedQuery && (
                <div className={styles.placeholder}>
                    <p>Results will appear here</p>
                </div>
            )}

            {isLoading && <div className={styles.placeholder}>Searching...</div>}

            {isFetched && results && (
                <div className={styles.results}>
                    <p className={styles.resultsCount}>
                        {results.length} {results.length === 1 ? 'match' : 'matches'} for &quot;{submittedQuery}&quot;
                    </p>
                    <div className={styles.resultList}>
                        {results.map((r, i) => (
                            <SearchResultRow key={`${r.episode_id}-${r.chunk_index}`} result={r} query={submittedQuery} rank={i+1} />
                        ))}
                    </div>
                </div>
            )}
        </main>
    )
}