"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  useActivity,
  useProfile,
  useWords,
  currentStreak,
  dateKey,
  addDays,
} from "@/lib/localStore"
import styles from "./StatsBar.module.css"

function plural(count: number, word: string): string {
  if (count === 1) {
    return `${count} ${word}`
  }
  return `${count} ${word}s`
}

/// One line summary of the learner's progress, read from localStorage.
/// The review link only appears when words are due, since that's the one
/// stat that asks the learner to do something.

export function StatsBar() {
  const activity = useActivity()
  const profile = useProfile()
  const words = useWords()

  if(activity === undefined || profile === undefined || words === undefined){
    return <div className={styles.skeleton} />
  }

  const today = dateKey()
  const weekStart = addDays(today, -6)

  const streak = currentStreak(activity, today)
  const minutesToday = Math.round(activity.minutesByDate[today] ?? 0)

  let wordsThisWeek = 0
  let dueCount = 0
  for(const word of words){
    if(dateKey(new Date(word.createdAt)) >= weekStart)
      wordsThisWeek += 1
    if(word.nextReviewDate <= today)
      dueCount += 1
  }

  return(
    <div className={styles.bar}>
      <p className={styles.line}>
        <span>{plural(streak, "day")} streak</span>
        <span className={styles.dot} aria-hidden="true">.</span>
        <span>
          {minutesToday} of {profile.dailyGoalMinutes} min today
        </span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span>{plural(wordsThisWeek, "word")} saved this week</span>
      </p>

      {dueCount > 0 && (
        <Link href="/review" className={styles.reviewLink}>
          Review {plural(dueCount, "word")}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )

}