"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Search as SearchIcon, Plus, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import {
  discoverPodcasts,
  addPodcast,
  getPodcasts,
  getDiscoverPreviews,
  type ItunesPodcast,
  type DiscoverPreview,
} from "@/lib/api"
import styles from "./page.module.css"

const SUGGESTIONS = ["learn English", "daily news", "storytelling", "history", "science", "business"]

const FIT_CLASS: Record<DiscoverPreview["fit"]["level"], string> = {
  great: "fitGreat",
  good: "fitGood",
  hard: "fitHard",
}

/// Search podcasts by topic and see how well each suits a learner. Details
/// come from each podcast's own feed, scored by rules on the server.
export default function DiscoverPage() {
  const [input, setInput] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const queryClient = useQueryClient()

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ["discover", submittedQuery],
    queryFn: () => discoverPodcasts(submittedQuery),
    enabled: submittedQuery.length > 0,
  })

  const feeds = (podcasts ?? []).map((p) => ({ feedUrl: p.feedUrl, genre: p.primaryGenreName }))

  const { data: previews, isLoading: previewsLoading } = useQuery({
    queryKey: ["discover-previews", feeds.map((f) => f.feedUrl)],
    queryFn: () => getDiscoverPreviews(feeds),
    enabled: feeds.length > 0,
    staleTime: 1000 * 60 * 60,
  })

  /// Feed URL to library id, so shows already added link to their page
  const { data: library } = useQuery({
    queryKey: ["podcasts"],
    queryFn: getPodcasts,
  })
  const libraryIdByFeed = new Map<string, string>()
  for (const p of library ?? []) {
    if (p.rss_url) {
      libraryIdByFeed.set(p.rss_url, p.id)
    }
  }

  const addMutation = useMutation({
    mutationFn: (podcast: ItunesPodcast) => addPodcast(podcast.feedUrl, podcast.artworkUrl600),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["podcasts"] })
      toast.success(`Added ${result.podcast.name} to your library`)
    },
    onError: () => {
      toast.error("Couldn't add that podcast. Try a different one.")
    },
  })

  const runSearch = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }
    setInput(trimmed)
    setSubmittedQuery(trimmed)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(input)
  }

  /// The feed URL of the podcast being added right now, if any
  let addingFeed: string | null = null
  if (addMutation.isPending && addMutation.variables) {
    addingFeed = addMutation.variables.feedUrl
  }

  let content
  if (!submittedQuery) {
    content = (
      <div className={styles.status}>
        <p>Search a topic you enjoy. Learning sticks better when you actually want to listen.</p>
      </div>
    )
  } else if (isLoading) {
    content = (
      <div className={styles.status}>
        <Loader2 size={22} className={styles.spinner} />
        <p>Finding podcasts...</p>
      </div>
    )
  } else if (!podcasts || podcasts.length === 0) {
    content = (
      <div className={styles.status}>
        <p>No podcasts found for &ldquo;{submittedQuery}&rdquo;. Try a broader topic.</p>
      </div>
    )
  } else {
    content = (
      <>
        <p className={styles.resultsCount} aria-live="polite">
          {podcasts.length} podcasts for &ldquo;{submittedQuery}&rdquo;
        </p>
        <div className={styles.grid}>
          {podcasts.map((podcast) => (
            <DiscoverCard
              key={podcast.collectionId}
              podcast={podcast}
              preview={previews ? previews[podcast.feedUrl] : undefined}
              previewLoading={previewsLoading}
              libraryId={libraryIdByFeed.get(podcast.feedUrl) ?? null}
              isAdding={addingFeed === podcast.feedUrl}
              anyAdding={addMutation.isPending}
              onAdd={() => addMutation.mutate(podcast)}
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Library</span>
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Discover</h1>
        <p className={styles.tagline}>
          Find podcasts by topic. Each one is checked for episode length, schedule, and language,
          so you can tell which are easiest to learn from.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.searchForm} role="search">
        <div className={styles.searchField}>
          <SearchIcon size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search a topic, like history or startups"
            aria-label="Search podcasts by topic"
            className={styles.searchInput}
          />
        </div>
        <button type="submit" className={styles.submitBtn}>
          Search
        </button>
      </form>

      <div className={styles.suggestions}>
        <span className={styles.suggestLabel}>Try:</span>
        {SUGGESTIONS.map((topic) => (
          <button key={topic} type="button" className={styles.chip} onClick={() => runSearch(topic)}>
            {topic}
          </button>
        ))}
      </div>

      {content}
    </main>
  )
}

function DiscoverCard({
  podcast,
  preview,
  previewLoading,
  libraryId,
  isAdding,
  anyAdding,
  onAdd,
}: {
  podcast: ItunesPodcast
  preview: DiscoverPreview | null | undefined
  previewLoading: boolean
  libraryId: string | null
  isAdding: boolean
  anyAdding: boolean
  onAdd: () => void
}) {
  let details
  if (previewLoading || preview === undefined) {
    details = (
      <div className={styles.details} aria-hidden="true">
        <div className={styles.skeletonPill} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineShort} />
      </div>
    )
  } else if (preview === null) {
    details = (
      <p className={styles.descriptionMissing}>Details for this show couldn&apos;t be loaded.</p>
    )
  } else {
    details = (
      <div className={styles.details}>
        <span className={`${styles.fitBadge} ${styles[FIT_CLASS[preview.fit.level]]}`}>
          {preview.fit.label}
        </span>
        {preview.fit.reasons.length > 0 && (
          <p className={styles.reasons}>{preview.fit.reasons.join(" · ")}</p>
        )}
        {preview.description ? (
          <p className={styles.description}>{preview.description}</p>
        ) : (
          <p className={styles.descriptionMissing}>This show has no description.</p>
        )}
      </div>
    )
  }

  let action
  if (libraryId) {
    action = (
      <Link href={`/podcast/${libraryId}`} className={styles.inLibrary}>
        <Check size={16} />
        In your library
      </Link>
    )
  } else {
    action = (
      <button onClick={onAdd} disabled={anyAdding} className={styles.addBtn}>
        {isAdding ? <Loader2 size={16} className={styles.spinner} /> : <Plus size={16} />}
        {isAdding ? "Adding..." : "Add to library"}
      </button>
    )
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={podcast.artworkUrl600} alt="" className={styles.cardArt} />
        <div className={styles.cardInfo}>
          <span className={styles.cardGenre}>{podcast.primaryGenreName}</span>
          <h2 className={styles.cardTitle}>{podcast.trackName}</h2>
          <p className={styles.cardMeta}>
            {podcast.artistName} · {podcast.trackCount} episodes
          </p>
        </div>
      </div>

      {details}

      {action}
    </article>
  )
}