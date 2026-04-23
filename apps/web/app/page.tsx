'use client'

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { getPodcasts } from "@/lib/api"
import { PodcastCard } from './components/PostcastCard'
import { AddPodcastModal } from './components/AddPodcastModal'
import styles from './page.module.css'
export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: podcasts, isLoading } = useQuery({
    queryKey: ['podcasts'],
    queryFn: getPodcasts,
  })

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>PodMind</h1>
          <p className={styles.tagline}>Search your podcasts by meaning.</p>
        </div>

        <div className={styles.actions}>
          <button className={styles.searchBtn}>
            <Search size={16} />
            <span>Search</span>
          </button>

          <button onClick={() => setIsModalOpen(true)} className={styles.addBtn}>
            <Plus size={16} />
            <span>Add podcast</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className={styles.loading}>
          Loading...
        </div>
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
      {isModalOpen && <AddPodcastModal onClose={() => setIsModalOpen(false)} />}
    </main>
  )
}