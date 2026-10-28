import { useSyncExternalStore } from "react"
import type { NativeLanguageCode, EnglishLevelCode } from "./constant"

/// All personal data lives in this browser's localStorage. There are no
/// accounts, so clearing site data resets progress. Every write fires a
/// change event, and the hooks at the bottom re-render any component that
/// uses the changed data, including in other open tabs.

const KEYS = {
  profile: "podmind:profile",
  vocabulary: "podmind:vocabulary",
  favorites: "podmind:favorites",
  activity: "podmind:activity",
} as const

const CHANGE_EVENT = "podmind:change"
const ACTIVITY_DAYS_KEPT = 30

/// Types

export interface LocalProfile {
  nativeLanguage: NativeLanguageCode
  englishLevel: EnglishLevelCode
  dailyGoalMinutes: number
  onboarded: boolean
}

export interface SavedWord {
  id: string
  word: string
  translation: string
  contextSentence: string
  episodeId: string
  timestampSeconds: number
  easeFactor: number
  intervalDays: number
  nextReviewDate: string
  reviewCount: number
  createdAt: string
}

export interface Activity {
  streak: number
  lastActiveDate: string | null
  minutesByDate: Record<string, number>
}

export type ReviewRating = 1 | 2 | 3 | 4

const DEFAULT_PROFILE: LocalProfile = {
  nativeLanguage: "vi",
  englishLevel: "B1",
  dailyGoalMinutes: 15,
  onboarded: false,
}

const DEFAULT_ACTIVITY: Activity = {
  streak: 0,
  lastActiveDate: null,
  minutesByDate: {},
}

const EMPTY_WORDS: SavedWord[] = []
const EMPTY_FAVORITES: string[] = []

/// Dates are stored as local YYYY-MM-DD strings. Using the learner's local
/// day (not UTC) means a streak rolls over at their midnight, and string
/// comparison sorts them correctly.

export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/// Raw access. localStorage can throw (private browsing, storage full,
/// blocked site data), so every access is wrapped and falls back safely.

function readRaw(key: string): string | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error("[localStore] could not save", key, err)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/// Profile

function parseProfile(raw: string | null): LocalProfile {
  if (raw === null) {
    return DEFAULT_PROFILE
  }
  return { ...DEFAULT_PROFILE, ...safeParse<Partial<LocalProfile>>(raw, {}) }
}

export function getProfile(): LocalProfile {
  return parseProfile(readRaw(KEYS.profile))
}

export function saveProfile(updates: Partial<LocalProfile>): void {
  writeJson(KEYS.profile, { ...getProfile(), ...updates })
}

/// Vocabulary

function parseWords(raw: string | null): SavedWord[] {
  return safeParse<SavedWord[]>(raw, EMPTY_WORDS)
}

export function getWords(): SavedWord[] {
  return parseWords(readRaw(KEYS.vocabulary))
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/// Saving the same word twice returns the existing entry, so its review
/// history is never reset by an accidental second save.
export function saveWord(input: {
  word: string
  translation: string
  contextSentence: string
  episodeId: string
  timestampSeconds: number
}): SavedWord {
  const words = getWords()
  const existing = words.find((w) => w.word === input.word)
  if (existing) {
    return existing
  }

  const created: SavedWord = {
    id: newId(),
    word: input.word,
    translation: input.translation,
    contextSentence: input.contextSentence,
    episodeId: input.episodeId,
    timestampSeconds: input.timestampSeconds,
    easeFactor: 2.5,
    intervalDays: 1,
    nextReviewDate: dateKey(),
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  }

  writeJson(KEYS.vocabulary, [created, ...words])
  return created
}

export function deleteWord(id: string): void {
  writeJson(
    KEYS.vocabulary,
    getWords().filter((w) => w.id !== id)
  )
}

export function getDueWords(today: string = dateKey()): SavedWord[] {
  return getWords()
    .filter((w) => w.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
}

/// SM-2 spaced repetition, moved from the backend.
/// 1 = Again, 2 = Hard, 3 = Good, 4 = Easy.

function nextInterval(intervalDays: number, easeFactor: number, rating: ReviewRating): number {
  if (rating === 1) {
    return 1
  }
  if (rating === 2) {
    return Math.max(1, Math.ceil(intervalDays * 1.2))
  }
  if (rating === 3) {
    return Math.ceil(intervalDays * easeFactor)
  }
  return Math.ceil(intervalDays * easeFactor * 1.3)
}

/// Used by the review buttons to show "1d", "2d", "3d" before the learner
/// picks, so the labels always match what will actually happen.
export function previewInterval(word: SavedWord, rating: ReviewRating): number {
  return nextInterval(word.intervalDays, word.easeFactor, rating)
}

export function reviewWord(id: string, rating: ReviewRating): SavedWord | null {
  const words = getWords()
  const index = words.findIndex((w) => w.id === id)
  const word = words[index]
  if (index === -1 || !word) {
    return null
  }

  const intervalDays = nextInterval(word.intervalDays, word.easeFactor, rating)
  const missed = 4 - rating
  const easeFactor = Math.max(1.3, word.easeFactor + 0.1 - missed * (0.08 + missed * 0.02))

  const updated: SavedWord = {
    ...word,
    intervalDays,
    easeFactor,
    nextReviewDate: addDays(dateKey(), intervalDays),
    reviewCount: word.reviewCount + 1,
  }

  const next = [...words]
  next[index] = updated
  writeJson(KEYS.vocabulary, next)
  recordActivity(0)
  return updated
}

/// Favorites (episode ids)

function parseFavorites(raw: string | null): string[] {
  return safeParse<string[]>(raw, EMPTY_FAVORITES)
}

export function getFavorites(): string[] {
  return parseFavorites(readRaw(KEYS.favorites))
}

export function toggleFavorite(episodeId: string): void {
  const favorites = getFavorites()
  if (favorites.includes(episodeId)) {
    writeJson(
      KEYS.favorites,
      favorites.filter((id) => id !== episodeId)
    )
  } else {
    writeJson(KEYS.favorites, [...favorites, episodeId])
  }
}

/// Activity: streak and minutes listened per day.
/// Listening or reviewing on a day keeps the streak alive.

function parseActivity(raw: string | null): Activity {
  if (raw === null) {
    return DEFAULT_ACTIVITY
  }
  return { ...DEFAULT_ACTIVITY, ...safeParse<Partial<Activity>>(raw, {}) }
}

export function getActivity(): Activity {
  return parseActivity(readRaw(KEYS.activity))
}

export function recordActivity(minutes: number): void {
  const today = dateKey()
  const yesterday = addDays(today, -1)
  const activity = getActivity()

  let streak = activity.streak
  if (activity.lastActiveDate === today) {
    /// Already counted today, streak stays the same
  } else if (activity.lastActiveDate === yesterday) {
    streak += 1
  } else {
    streak = 1
  }

  const minutesByDate = { ...activity.minutesByDate }
  minutesByDate[today] = (minutesByDate[today] ?? 0) + minutes

  /// Only keep the last 30 days so this never grows forever
  const cutoff = addDays(today, -ACTIVITY_DAYS_KEPT)
  for (const key of Object.keys(minutesByDate)) {
    if (key < cutoff) {
      delete minutesByDate[key]
    }
  }

  writeJson(KEYS.activity, { streak, lastActiveDate: today, minutesByDate })
}

/// A saved streak only counts if it was continued today or yesterday.
/// Missing a full day means it shows as 0 until the next activity.
export function currentStreak(activity: Activity, today: string = dateKey()): number {
  if (activity.lastActiveDate === today || activity.lastActiveDate === addDays(today, -1)) {
    return activity.streak
  }
  return 0
}

/// React hooks
///
/// useSyncExternalStore needs getSnapshot to return the same object until the
/// data actually changes, otherwise React re-renders forever. The cache keeps
/// the parsed value for each key and only re-parses when the raw string changes.
/// During server rendering the hooks return undefined, which components treat
/// as "not loaded yet", so the server and first client render always match.

const snapshotCache = new Map<string, { raw: string | null; value: unknown }>()

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function useStoredValue<T>(key: string, parse: (raw: string | null) => T): T | undefined {
  const getSnapshot = (): T => {
    const raw = readRaw(key)
    const hit = snapshotCache.get(key)
    if (hit && hit.raw === raw) {
      return hit.value as T
    }
    const value = parse(raw)
    snapshotCache.set(key, { raw, value })
    return value
  }

  return useSyncExternalStore<T | undefined>(subscribe, getSnapshot, () => undefined)
}

export function useProfile(): LocalProfile | undefined {
  return useStoredValue(KEYS.profile, parseProfile)
}

export function useWords(): SavedWord[] | undefined {
  return useStoredValue(KEYS.vocabulary, parseWords)
}

export function useFavorites(): string[] | undefined {
  return useStoredValue(KEYS.favorites, parseFavorites)
}

export function useActivity(): Activity | undefined {
  return useStoredValue(KEYS.activity, parseActivity)
}