'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Compass } from 'lucide-react'
import { getPodcasts, getProfile } from '@/lib/api'
import { PodcastCard } from './components/PostcastCard'
import { AddPodcastModal } from './components/AddPodcastModal'
import styles from './page.module.css'

const UserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.UserButton),
  { ssr: false }
)

const OnboardingModal = dynamic(
  () => import('./components/OnboardingModal').then((mod) => mod.OnboardingModal),
  { ssr: false }
)

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
    <div className={styles.hero}>
      <div className={styles.heroInner}>
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
      </div>
    </div>

    <div className={styles.content}>
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
    </div>

    {isAddModalOpen && <AddPodcastModal onClose={() => setIsAddModalOpen(false)} />}
    {showOnboarding && <OnboardingModal />}
  </main>
)
}