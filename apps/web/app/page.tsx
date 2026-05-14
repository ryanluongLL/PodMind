'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Compass } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { getPodcasts, getProfile } from '@/lib/api'
import { PodcastCard } from './components/PostcastCard'
import { AddPodcastModal } from './components/AddPodcastModal'
import { OnboardingModal } from './components/OnboardingModal'
import styles from './page.module.css'

export default function Home() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ['podcasts'],
    queryFn: getPodcasts,
  })

  // Fetch the user's profile to determine if they need onboarding
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })

  // Show onboarding only on first sign-in (when onboarded flag is false)
  const showOnboarding = profile && !profile.onboarded

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>PodMind</h1>
          <p className={styles.tagline}>Master English with real podcasts.</p>
        </div>

        <div className={styles.actions}>
          <Link href="/search" className={styles.searchBtn}>
            <Search size={16} />
            <span>Search</span>
          </Link>
          <Link href="/discover" className={styles.searchBtn}>
            <Compass size={16} />
            <span>Discover</span>
          </Link>
          <button onClick={() => setIsAddModalOpen(true)} className={styles.addBtn}>
            <Plus size={16} />
            <span>Add podcast</span>
          </button>
          <UserButton />
        </div>
      </header>

      {isLoading ? (
        <div className={styles.loading}>Loading...</div>
      ) : podcasts && podcasts.length > 0 ? (
        <div className={styles.grid}>
          {podcasts.map((p) => (
            <PodcastCard key={p.id} podcast={p} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No podcasts added yet</p>
        </div>
      )}

      {isAddModalOpen && <AddPodcastModal onClose={() => setIsAddModalOpen(false)} />}
      {showOnboarding && <OnboardingModal />}
    </main>
  )
}