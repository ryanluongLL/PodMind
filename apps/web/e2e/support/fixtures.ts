import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test"

/// Shared setup for every end to end test.

export const FAKES_URL = "http://localhost:3102"
export const FEED_URL = `${FAKES_URL}/feed.xml`

/// Matches every address that is not this machine
const OUTSIDE_WORLD = /^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/

export const test = base.extend<{ cleanSlate: void }>({
  /// Runs before each test without being asked for: empties the shared
  /// library and blocks the internet, so no test depends on another test or
  /// on a website being up. Tests that need iTunes add their own fake for it.
  cleanSlate: [
    async ({ page, request }, run) => {
      const res = await request.post(`${FAKES_URL}/__reset`)
      expect(res.ok()).toBe(true)
      await page.route(OUTSIDE_WORLD, (route) => route.abort())
      await run()
    },
    { auto: true },
  ],
})

export { expect }

interface ProfileOptions {
  nativeLanguage?: "vi" | "es" | "zh" | "ko" | "ja" | "pt"
  englishLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
  dailyGoalMinutes?: number
}

/// Starts the browser as a returning learner who already did onboarding.
/// Only fills in localStorage when it is empty, so later page loads in the
/// same test keep whatever the test saved.
export async function asReturningLearner(page: Page, options: ProfileOptions = {}): Promise<void> {
  const profile = {
    nativeLanguage: options.nativeLanguage ?? "es",
    englishLevel: options.englishLevel ?? "B1",
    dailyGoalMinutes: options.dailyGoalMinutes ?? 15,
    onboarded: true,
  }
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("podmind:profile") === null) {
      window.localStorage.setItem("podmind:profile", value)
    }
  }, JSON.stringify(profile))
}

/// Adds one saved word that is due for review today, as if the learner had
/// saved it from a transcript earlier
export async function withSavedWord(page: Page, word: string, translation: string, contextSentence: string): Promise<void> {
  await page.addInitScript(
    ({ word, translation, contextSentence }) => {
      if (window.localStorage.getItem("podmind:vocabulary") !== null) {
        return
      }
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      const saved = {
        id: "e2e-word-1",
        word,
        translation,
        contextSentence,
        episodeId: "e2e-episode",
        timestampSeconds: 4,
        easeFactor: 2.5,
        intervalDays: 1,
        nextReviewDate: today,
        reviewCount: 0,
        createdAt: now.toISOString(),
      }
      window.localStorage.setItem("podmind:vocabulary", JSON.stringify([saved]))
    },
    { word, translation, contextSentence }
  )
}

/// The browser searches the iTunes directory directly, so tests answer for
/// it with one known podcast whose feed is the local fake
export async function fakeItunes(page: Page): Promise<void> {
  await page.route("https://itunes.apple.com/search?**", (route) =>
    route.fulfill({
      json: {
        resultCount: 1,
        results: [
          {
            collectionId: 1001,
            trackName: "Slow English Stories",
            artistName: "PodMind Test Studio",
            artworkUrl600: `${FAKES_URL}/art.png`,
            artworkUrl100: `${FAKES_URL}/art.png`,
            feedUrl: FEED_URL,
            primaryGenreName: "Language Learning",
            trackCount: 2,
          },
        ],
      },
    })
  )
  await page.route("https://itunes.apple.com/us/rss/**", (route) => route.fulfill({ json: { feed: { entry: [] } } }))
}

/// One podcast with a finished transcript, as if the worker already ran
export async function seedTranscribedEpisode(request: APIRequestContext): Promise<{ podcastId: string; episodeId: string }> {
  const res = await request.post(`${FAKES_URL}/__seed/transcribed-episode`)
  expect(res.ok()).toBe(true)
  return (await res.json()) as { podcastId: string; episodeId: string }
}