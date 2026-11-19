"use client"

import { useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { getPodcasts, type Podcast } from "@/lib/api"
import { hidePodcast, restorePodcast, useHiddenPodcasts, useProfile } from "@/lib/localStore"
import { PodcastCard } from "./components/PostcastCard"
import { AddPodcastModal } from "./components/AddPodcastModal"
import { StatsBar } from "./components/StatsBar"
import styles from "./page.module.css"

/// Loaded only in the browser, since it depends on localStorage
const OnboardingModal = dynamic(
  () => import("./components/OnboardingModal").then((mod) => mod.OnboardingModal),
  { ssr: false }
)

export default function Home() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const profile = useProfile()
  const hiddenIds = useHiddenPodcasts()

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ["podcasts"],
    queryFn: getPodcasts,
  })

  /// profile is undefined until the browser has read localStorage, so the
  /// modal never flashes on screen for returning visitors
  const showOnboarding = profile !== undefined && !profile.onboarded

  /// Hiding only affects this browser. The toast offers Undo, and the
  /// "Show hidden" section below the grid can restore it later too.
  const handleHide = (podcast: Podcast) => {
    hidePodcast(podcast.id)
    toast(`Removed ${podcast.name} from your library`, {
      action: { label: "Undo", onClick: () => restorePodcast(podcast.id) },
    })
  }

  const handleRestore = (podcast: Podcast) => {
    restorePodcast(podcast.id)
    toast.success(`Restored ${podcast.name} to your library`)
  }

  let visiblePodcasts: Podcast[] = []
  let hiddenPodcasts: Podcast[] = []
  if (podcasts && hiddenIds) {
    visiblePodcasts = podcasts.filter((p) => !hiddenIds.includes(p.id))
    hiddenPodcasts = podcasts.filter((p) => hiddenIds.includes(p.id))
  }

  let libraryContent
  /// hiddenIds is undefined until the browser has read localStorage, so the
  /// skeleton stays up and hidden podcasts never flash on screen first
  if (isLoading || hiddenIds === undefined) {
    libraryContent = (
      <div className={styles.grid}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className={styles.skeletonCover} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
          </div>
        ))}
      </div>
    )
  } else if (visiblePodcasts.length > 0) {
    libraryContent = (
      <div className={styles.grid}>
        {visiblePodcasts.map((p) => (
          <PodcastCard key={p.id} podcast={p} onHide={handleHide} />
        ))}
      </div>
    )
  } else {
    libraryContent = (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Start with one podcast</h2>
        <p className={styles.emptyText}>
          Pick a show you&apos;d listen to anyway. Episodes between 5 and 15 minutes are the
          easiest place to start.
        </p>
        <div className={styles.emptyActions}>
          <button onClick={() => setIsAddModalOpen(true)} className={styles.primaryBtn}>
            <Plus size={16} />
            Add podcast
          </button>
          <Link href="/discover" className={styles.secondaryBtn}>
            Browse by topic
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className={styles.main}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            PodMind
          </Link>

          <nav className={styles.links} aria-label="Main">
            <Link href="/search" className={styles.link}>
              Search
            </Link>
            <Link href="/discover" className={styles.link}>
              Discover
            </Link>
            <Link href="/vocabulary" className={styles.link}>
              Vocabulary
            </Link>
            <Link href="/review" className={styles.link}>
              Review
            </Link>
          </nav>

          <div className={styles.navRight}>
            <button onClick={() => setIsAddModalOpen(true)} className={styles.primaryBtn}>
              <Plus size={16} />
              Add podcast
            </button>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.intro}>
          <h1 className={styles.title}>Your library</h1>
          <StatsBar />
        </section>

        {libraryContent}

        {hiddenPodcasts.length > 0 && (
          <section className={styles.hiddenSection} aria-label="Hidden podcasts">
            <button
              type="button"
              onClick={() => setShowHidden((shown) => !shown)}
              className={styles.hiddenToggle}
              aria-expanded={showHidden}
            >
              {showHidden ? "Hide" : "Show"} hidden podcasts ({hiddenPodcasts.length})
            </button>
            {showHidden && (
              <div className={`${styles.grid} ${styles.hiddenGrid}`}>
                {hiddenPodcasts.map((p) => (
                  <PodcastCard key={p.id} podcast={p} hidden onRestore={handleRestore} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {isAddModalOpen && <AddPodcastModal onClose={() => setIsAddModalOpen(false)} />}
      {showOnboarding && <OnboardingModal />}
    </main>
  )
}