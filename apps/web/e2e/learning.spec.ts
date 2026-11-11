import { test, expect, asReturningLearner, withSavedWord, seedTranscribedEpisode } from "./support/fixtures"
import type { Page } from "@playwright/test"

const MONEY_LINE = "Today I need to deposit money at the bank."
const RIVER_LINE = "Later we walked along the bank of the river."

/// One clickable word inside one transcript line
function wordInLine(page: Page, line: string, word: string) {
  return page.getByText(line, { exact: true }).getByText(word, { exact: true })
}

async function openTranscript(page: Page, podcastId: string): Promise<void> {
  await page.goto(`/podcast/${podcastId}`)
  await page.getByRole("button", { name: "Show transcript" }).click()
  await expect(page.getByText("Click a word to look it up.", { exact: false })).toBeVisible()
}

test.describe("word lookup and vocabulary", () => {
  test("looking up a word picks the meaning that fits the sentence, and saving it adds it to vocabulary", async ({ page, request }) => {
    const { podcastId } = await seedTranscribedEpisode(request)
    await asReturningLearner(page, { nativeLanguage: "es" })
    await openTranscript(page, podcastId)

    await wordInLine(page, MONEY_LINE, "bank.").click()

    const popup = page.getByRole("dialog", { name: "bank" })
    await expect(popup.getByText("banco")).toBeVisible()
    /// The main part of speech comes first; "Other meanings" lists more below
    await expect(popup.getByText("noun", { exact: true }).first()).toBeVisible()
    await expect(popup.getByText(/a financial institution/)).toBeVisible()
    await expect(popup.getByLabel("Word frequency: Common")).toBeVisible()
    await expect(popup.getByText("Heard in your podcasts")).toBeVisible()
    await expect(popup.getByRole("button", { name: new RegExp(RIVER_LINE.slice(0, 20)) })).toBeVisible()

    await popup.getByRole("button", { name: "Save to vocabulary" }).click()
    await expect(popup.getByRole("button", { name: "Saved to vocabulary" })).toBeDisabled()

    await page.keyboard.press("Escape")
    await expect(popup).toBeHidden()

    await page.goto("/vocabulary")
    await expect(page.getByText("1 word saved from your podcasts")).toBeVisible()
    await expect(page.getByText("bank", { exact: true })).toBeVisible()
    await expect(page.getByText("banco", { exact: true })).toBeVisible()
    await expect(page.getByText(`“${MONEY_LINE}”`)).toBeVisible()
    await expect(page.getByText("Due now")).toBeVisible()

    /// Saved words live in this browser and survive a reload
    await page.reload()
    await expect(page.getByText("banco", { exact: true })).toBeVisible()
  })

  test("the same word in a river sentence gets the river meaning", async ({ page, request }) => {
    const { podcastId } = await seedTranscribedEpisode(request)
    await asReturningLearner(page, { nativeLanguage: "vi" })
    await openTranscript(page, podcastId)

    await wordInLine(page, RIVER_LINE, "bank").click()

    const popup = page.getByRole("dialog", { name: "bank" })
    await expect(popup.getByText(/sloping land/)).toBeVisible()
    await expect(popup.getByText(/Other meanings \(2\)/)).toBeVisible()
  })

  test("a word saved earlier still shows as saved in the popup", async ({ page, request }) => {
    const { podcastId } = await seedTranscribedEpisode(request)
    await asReturningLearner(page)
    await withSavedWord(page, "bank", "banco", MONEY_LINE)
    await openTranscript(page, podcastId)

    await wordInLine(page, MONEY_LINE, "bank.").click()
    await expect(page.getByRole("dialog", { name: "bank" }).getByRole("button", { name: "Saved to vocabulary" })).toBeDisabled()
  })
})

test.describe("review", () => {
  test("reviewing a due word schedules the next review and starts a streak", async ({ page }) => {
    await asReturningLearner(page)
    await withSavedWord(page, "bank", "banco", MONEY_LINE)

    await page.goto("/")
    await expect(page.getByRole("link", { name: "Review 1 word" })).toBeVisible()
    await expect(page.getByText("0 days streak")).toBeVisible()

    await page.getByRole("link", { name: "Review 1 word" }).click()
    await expect(page.getByText("1 of 1")).toBeVisible()
    await expect(page.getByRole("heading", { name: "bank" }).first()).toBeVisible()

    await page.keyboard.press("Space")
    await expect(page.getByText("banco")).toBeVisible()
    const good = page.getByRole("button", { name: /3\. Good/ })
    await expect(good).toContainText("3 days")
    await good.click()

    await expect(page.getByRole("heading", { name: "Session complete" })).toBeVisible()
    await expect(page.getByText("You reviewed 1 word.")).toBeVisible()

    await page.getByRole("link", { name: "View vocabulary" }).click()
    await expect(page.getByText("Review in 3 days")).toBeVisible()
    await expect(page.getByText("1 review", { exact: true })).toBeVisible()

    await page.goto("/")
    await expect(page.getByText("1 day streak")).toBeVisible()
    await expect(page.getByRole("link", { name: /Review \d+ word/ })).toHaveCount(0)
  })

  test("with nothing due, review says so", async ({ page }) => {
    await asReturningLearner(page)
    await page.goto("/review")
    await expect(page.getByRole("heading", { name: "Nothing to review" })).toBeVisible()
  })
})