"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X, Search, Loader2, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import {
  addPodcast,
  searchItunesPodcasts,
  getTrendingPodcasts,
  type ItunesPodcast,
} from "@/lib/api"
import { useDebounce } from "@/lib/useDebounce"
import styles from "./AddPodcastModal.module.css"

/// Search the iTunes directory and add a podcast to the shared library.
/// Shows trending podcasts while the search box is empty.
export function AddPodcastModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  /// Only hit iTunes after the user pauses typing
  const debouncedSearch = useDebounce(search, 300)
  const hasQuery = search.trim().length > 0

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["itunes-search", debouncedSearch],
    queryFn: () => searchItunesPodcasts(debouncedSearch),
    enabled: debouncedSearch.trim().length > 0,
  })

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ["itunes-trending"],
    queryFn: getTrendingPodcasts,
    enabled: !hasQuery,
    /// Cache for an hour, the chart barely changes
    staleTime: 1000 * 60 * 60,
  })

  const displayList = hasQuery ? searchResults : trending
  const isLoading = hasQuery ? searchLoading : trendingLoading

  /// Reset the highlighted row whenever the search changes. Comparing with
  /// the previous search during render avoids an extra render from an effect.
  const [lastSearch, setLastSearch] = useState(debouncedSearch)
  if (debouncedSearch !== lastSearch) {
    setLastSearch(debouncedSearch)
    setHighlighted(0)
  }

  /// Never point past the end of the list, for example after switching
  /// from the long trending list to a short set of search results
  let activeIndex = 0
  if (displayList && displayList.length > 0) {
    activeIndex = Math.min(highlighted, displayList.length - 1)
  }

  const addMutation = useMutation({
    mutationFn: (podcast: ItunesPodcast) => addPodcast(podcast.feedUrl, podcast.artworkUrl600),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["podcasts"] })
      toast.success("Podcast added to your library")
      onClose()
    },
    onError: () => {
      toast.error("Couldn't add that podcast. Try a different one.")
    },
  })

  /// Focus the search box when the modal opens. This touches the DOM, not
  /// React state, so it belongs in an effect.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /// Arrow keys move the highlight, Enter adds it, Escape closes the modal.
  /// Escape is checked first so it works even while results are loading.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (!displayList || displayList.length === 0) {
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlighted(Math.min(activeIndex + 1, displayList.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted(Math.max(activeIndex - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const podcast = displayList[activeIndex]
      if (podcast && !addMutation.isPending) {
        addMutation.mutate(podcast)
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-podcast-title"
      >
        <div className={styles.header}>
          <h2 id="add-podcast-title" className={styles.title}>
            Add a podcast
          </h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search podcasts by name or topic"
            aria-label="Search podcasts"
            className={styles.input}
          />
          {searchLoading && hasQuery && <Loader2 size={18} className={styles.spinner} />}
        </div>

        {!hasQuery && trending && trending.length > 0 && (
          <div className={styles.sectionHeader}>
            <TrendingUp size={14} aria-hidden="true" />
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
            <div className={styles.emptyState}>No podcasts match &ldquo;{search}&rdquo;</div>
          )}

          {!isLoading &&
            displayList?.map((podcast, i) => (
              <PodcastResultRow
                key={podcast.collectionId}
                podcast={podcast}
                isHighlighted={i === activeIndex}
                isAdding={addMutation.isPending}
                onClick={() => addMutation.mutate(podcast)}
                onHover={() => setHighlighted(i)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

/// One result row: artwork, title, host, and episode count
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
  onHover: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      disabled={isAdding}
      className={`${styles.resultRow} ${isHighlighted ? styles.resultHighlighted : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={podcast.artworkUrl100} alt="" className={styles.resultArt} />
      <div className={styles.resultInfo}>
        <h3 className={styles.resultTitle}>{podcast.trackName}</h3>
        <p className={styles.resultMeta}>
          {podcast.artistName} · {podcast.trackCount} episodes
        </p>
      </div>
    </button>
  )
}