'use client'

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Search as SearchIcon, Sparkles, Plus, Loader2 } from "lucide-react"
import { discoverPodcasts, addPodcast, type ItunesPodcast } from "@/lib/api"
import { useDebounce } from "@/lib/useDebounce"
import { api } from "@/lib/api"
import styles from './page.module.css'

interface Summary{
    id: number
    summary:string
}

/// Discover page — search for podcasts by topic, get AI summaries, add to library.
/// Unlike the semantic search page, this doesn't require any prior transcription.
/// It hits iTunes for podcast metadata and Claude for topic-relevant summaries.

export default function DiscoverPage() {
    const [input, setInput] = useState('')
    const [submittedQuery, setSubmittedQuery] = useState('')
    const [summaries, setSummaries] = useState<Summary[]>([])
    const [summaryLoading, setSummaryLoading] = useState(false)
    const queryClient = useQueryClient()

    ///fetch iTunes results when user submits
    const { data: podcasts, isLoading: podcastsLoading } = useQuery({
        queryKey: ['discover', submittedQuery],
        queryFn: () => discoverPodcasts(submittedQuery),
        enabled: submittedQuery.length > 0,
    })

    ///after iTunes results arrive, fetch AI summaries
    const fetchSummaries = async (results: ItunesPodcast[], query: string) => {
        setSummaryLoading(true)
        setSummaries([])
        try {
            const { data } = await api.post('/discover/summrize', {
                query,
                podcasts: results.map(p => ({
                    name: p.trackName,
                    artist: p.artistName,
                    genre: p.primaryGenreName,
                    episodeCount: p.trackCount,
                    description: (p as ItunesPodcast & {description?: string}).description,
                }))
            })
            setSummaries(data.summaries)
        } catch (err) {
            
        } finally {
            setSummaryLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return
        setSubmittedQuery(input.trim())
        setSummaries([])
    }

    ///when podcasts load, fetch summaries
    const prevQuery = useState('')[0]
    if (podcasts && podcasts.length > 0 && submittedQuery !== prevQuery && !summaryLoading && summaries.length === 0) {
        fetchSummaries(podcasts, submittedQuery)
    }

    const addMutation = useMutation({
        mutationFn: (feedUrl: string) => addPodcast(feedUrl),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['podcasts']})
        }
    })

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
                <h1 className={styles.title}>Discover Podcasts</h1>
                <p className={styles.tagline}>
                    Search any topic and get podcast recommendations
                </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.searchForm}>
                <SearchIcon size={20} className={styles.searchIcon} />
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder='Try "stoicism", "startups", "positive thinking"...'
                    className={styles.searchInput}
                />
                <button type="submit" className={styles.submitBtn}>
                    Discover
                </button>
            </form>

            {!submittedQuery && (
                <div className={styles.placeholder}>
                    <p>Search any topic to get podcast picks</p>
                </div>
            )}

            {podcastsLoading && (
                <div className={styles.placeholder}>
                    <Loader2 size={24} className={styles.spinner} />
                    <p>Finding podcasts...</p>
                </div>
            )}

            {podcasts && podcasts.length > 0 && (
                <div className={styles.results}>
                    <p className={styles.resultsCount}>
                        Top {podcasts.length} podcasts about &quot;{submittedQuery}&quot;
                    </p>

                    <div className={styles.cardGrid}>
                        {podcasts.map((podcast, i) => {
                            const summary = summaries.find(s => s.id === i + 1)
                            const isAdded = addMutation.isSuccess
                            return (
                                <div key={podcast.collectionId} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={podcast.artworkUrl600}
                                            alt={podcast.trackName}
                                            className={styles.cardArt}
                                        />

                                        <div className={styles.cardInfo}>
                                            <span className={styles.cardGenre}>
                                                {podcast.primaryGenreName}
                                            </span>
                                            <h3 className={styles.cardTitle}>{podcast.trackName}</h3>
                                            <p className={styles.cardArtist}>by {podcast.artistName}</p>
                                            <p className={styles.cardEpisodes}>{podcast.trackCount} episodes</p>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.cardSummary}>
                                        {summaryLoading && !summary && (
                                            <div className={styles.summaryLoading}>
                                                <Loader2 size={14} className={styles.spinner} />
                                                <span>Generating summary...</span>
                                            </div>
                                        )}
                                        {summary && (
                                            <p className={styles.summaryText}>
                                                <Sparkles size={14} className={styles.summaryIcon} />
                                                {summary.summary}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => addMutation.mutate(podcast.feedUrl)}
                                        disabled={addMutation.isPending}
                                        className={styles.addBtn}
                                    >
                                        <Plus size={16} />
                                        Add to library
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {podcasts && podcasts?.length === 0 && submittedQuery && (
                <div className={styles.placeholder}>
                    <p>No podcasts found for &quot;{submittedQuery}&quot;</p>
                </div>
            )}
        </main>
    )

}