"use client"

import { useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { getPodcasts } from "@/lib/api"
import { useProfile } from "@/lib/localStore"
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
  const profile = useProfile()

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ["podcasts"],
    queryFn: getPodcasts,
  })

  /// profile is undefined until the browser has read localStorage, so the
  /// modal never flashes on screen for returning visitors
  const showOnboarding = profile !== undefined && !profile.onboarded

  let libraryContent
  if (isLoading) {
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
  } else if (podcasts && podcasts.length > 0) {
    libraryContent = (
      <div className={styles.grid}>
        {podcasts.map((p) => (
          <PodcastCard key={p.id} podcast={p} />
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
      </div>

      {isAddModalOpen && <AddPodcastModal onClose={() => setIsAddModalOpen(false)} />}
      {showOnboarding && <OnboardingModal />}
    </main>
  )
}