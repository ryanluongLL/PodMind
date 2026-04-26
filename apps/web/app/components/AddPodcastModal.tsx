'use client'

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { X, Search, Loader2, TrendingUp } from "lucide-react"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addPodcast, searchItunesPodcasts, getTrendingPodcasts } from "@/lib/api"
import { useDebounce } from "@/lib/useDebounce"
import styles from './AddPodcastModal.module.css'
import { ItunesPodcast } from '../../lib/api';

export function AddPodcastModal({ onClose }: { onClose: () => void }) {
    const [search, setSearch] = useState('')
    const [highlighted, setHighlighted] = useState(0)
    const queryClient = useQueryClient()
    const inputRef = useRef<HTMLInputElement>(null)

    ///debounce the search so we only hit iTunes after the user pauses typing
    const debouncedSearch = useDebounce(search, 300)

    ///search iTunes when there's query
    const { data: searchResults, isLoading: searchLoading } = useQuery({
        queryKey: ['itunes-search', debouncedSearch],
        queryFn: () => searchItunesPodcasts(debouncedSearch),
        enabled: debouncedSearch.trim().length > 0,
    })

    ///show trending when the search box is empty
    const { data: trending, isLoading: trendingLoading } = useQuery({
        queryKey: ['itunes-trending'],
        queryFn: getTrendingPodcasts,
        enabled: search.trim().length === 0,
        staleTime: 1000 * 60 * 60, ///cache for an hour
    })


    ///pick which list to display based on whether the user has typed anything
    const displayList = search.trim() ? searchResults : trending
    const isLoading = search.trim() ? searchLoading : trendingLoading

    ///add the selected podcast to the user's library by feedUrl
    const addMutation = useMutation({
        mutationFn: (feedUrl: string) => addPodcast(feedUrl),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['podcasts'] })
            onClose()
        }
    })


    ///reset highlighted item when results change
    useEffect(() => {
        setHighlighted(0)
    }, [debouncedSearch])


    ///auto-focus the input when modal opens
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    ///keyboard navigation: arrow keys to move, enter to select, escape to close
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!displayList || displayList.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted((h) => Math.min(h+1, displayList.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted((h) => Math.max(h - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const podcast = displayList[highlighted]
            if(podcast) addMutation.mutate(podcast.feedUrl)
        } else if (e.key === 'Escape') {
            onClose()
        }
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Add a podcast</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.searchWrapper}>
                    <Search size={18} className={styles.searchIcon} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search podcasts..."
                        className={styles.input}
                    />
                    {searchLoading && search.trim() && (
                        <Loader2 size={18} className={styles.spinner} />
                    )}
                </div>

                {!search.trim() && trending && trending.length > 0 && (
                    <div className={styles.sectionHeader}>
                        <TrendingUp size={14} />
                        <span>Trending</span>
                    </div>
                )}

                <div className={styles.results}>
                    {isLoading && (
                        <div className={styles.loadingState}>
                            <Loader2 size={20} className={styles.spinner} />
                        </div>
                    )}

                    {!isLoading && displayList && displayList.length === 0 && (
                        <div className={styles.emptyState}>
                            No podcasts found &ldquo;{search}&rdquo;
                        </div>
                    )}

                    {!isLoading && displayList?.map((podcast, i) => (
                        <PodcastResultRow
                            key={podcast.collectionId}
                            podcast={podcast}
                            isHighlighted={i === highlighted}
                            isAdding={addMutation.isPending}
                            onClick={() => addMutation.mutate(podcast.feedUrl)}
                            onHover={() => setHighlighted(i)}
                        />
                    ))}
                </div>

                {addMutation.isError && (
                    <p className={styles.error}>
                        Failed to add podcast. Try a different one.
                    </p>
                )}
            </div>
        </div>
    )
}

///individual podcast row in the dropdown
function PodcastResultRow({
    podcast,
    isHighlighted,
    isAdding,
    onClick,
    onHover,
}: {
    podcast: ItunesPodcast
    isHighlighted: boolean
    isAdding: boolean
    onClick: () => void
    onHover:() => void
}) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onHover}
            disabled={isAdding}
            className={`${styles.resultRow} ${isHighlighted ? styles.resultHighlighted : ''}`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={podcast.artworkUrl100}
                alt={podcast.trackName}
                className={styles.resultArt}
            />
            <div className={styles.resultInfo}>
                <h3 className={styles.resultTitle}>{podcast.trackName}</h3>
                <p className={styles.resultMeta}>
                    {podcast.artistName} · {podcast.trackCount} episodes
                </p>
            </div>
        </button>
    )
}