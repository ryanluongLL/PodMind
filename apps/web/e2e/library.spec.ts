import { test, expect, asReturningLearner, fakeItunes } from "./support/fixtures"

test.describe("library", () => {
  test.beforeEach(async ({ page }) => {
    await asReturningLearner(page)
    await fakeItunes(page)
  })

  test("an empty library invites the learner to add a podcast", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Start with one podcast" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Browse by topic" })).toBeVisible()
  })

  test("adding a podcast from search puts it in the library with its episodes", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()

    const dialog = page.getByRole("dialog", { name: "Add a podcast" })
    await expect(dialog.getByRole("textbox", { name: "Search podcasts" })).toBeFocused()
    await dialog.getByRole("textbox", { name: "Search podcasts" }).fill("slow english")
    await dialog.getByRole("button", { name: /Slow English Stories/ }).click()

    await expect(page.getByText("Podcast added to your library")).toBeVisible()
    await expect(dialog).toBeHidden()

    const card = page.getByRole("link", { name: /Slow English Stories/ })
    await expect(card).toContainText("2 episodes")
    await card.click()

    await expect(page.getByRole("heading", { level: 1, name: "Slow English Stories" })).toBeVisible()
    const titles = page.getByRole("heading", { level: 3 })
    await expect(titles).toHaveText(["A Day at the Bank", "Meeting New Friends"])
  })

  test("asking for a transcript past the daily limit explains why it did not start", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()
    await page.getByRole("textbox", { name: "Search podcasts" }).fill("slow english")
    await page.getByRole("button", { name: /Slow English Stories/ }).click()
    await page.getByRole("link", { name: /Slow English Stories/ }).click()

    await page.getByRole("button", { name: "Transcribe episode" }).first().click()

    await expect(page.getByText("Daily transcription limit reached. Try again tomorrow.")).toBeVisible()
    await expect(page.getByText("Transcript ready")).toHaveCount(0)
  })

  test("Escape closes the add podcast dialog", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()
    await expect(page.getByRole("dialog", { name: "Add a podcast" })).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Add a podcast" })).toBeHidden()
  })

  test("favoriting an episode moves it to the top and survives a reload", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()
    await page.getByRole("textbox", { name: "Search podcasts" }).fill("slow english")
    await page.getByRole("button", { name: /Slow English Stories/ }).click()
    await page.getByRole("link", { name: /Slow English Stories/ }).click()

    const titles = page.getByRole("heading", { level: 3 })
    await expect(titles).toHaveText(["A Day at the Bank", "Meeting New Friends"])

    await page.getByRole("button", { name: "Add favorite" }).nth(1).click()
    await expect(titles).toHaveText(["Meeting New Friends", "A Day at the Bank"])

    await page.reload()
    await expect(titles).toHaveText(["Meeting New Friends", "A Day at the Bank"])
  })

  test("removing a podcast hides it in this browser until it is restored", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()
    await page.getByRole("textbox", { name: "Search podcasts" }).fill("slow english")
    await page.getByRole("button", { name: /Slow English Stories/ }).click()
    await expect(page.getByRole("link", { name: /Slow English Stories/ })).toBeVisible()

    await page.getByRole("button", { name: "Remove Slow English Stories from my library" }).click()
    await expect(page.getByText("Removed Slow English Stories from your library")).toBeVisible()
    await expect(page.getByRole("link", { name: /Slow English Stories/ })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Start with one podcast" })).toBeVisible()

    /// Hidden is stored in localStorage, so it survives a reload
    await page.reload()
    await expect(page.getByRole("link", { name: /Slow English Stories/ })).toHaveCount(0)

    const toggle = page.getByRole("button", { name: "Show hidden podcasts (1)" })
    await toggle.click()
    await page.getByRole("button", { name: "Restore Slow English Stories to my library" }).click()

    await expect(page.getByRole("link", { name: /Slow English Stories/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /hidden podcasts/ })).toHaveCount(0)
  })

  test("Undo in the toast brings a removed podcast straight back", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Add podcast" }).first().click()
    await page.getByRole("textbox", { name: "Search podcasts" }).fill("slow english")
    await page.getByRole("button", { name: /Slow English Stories/ }).click()

    await page.getByRole("button", { name: "Remove Slow English Stories from my library" }).click()
    await page.getByRole("button", { name: "Undo" }).click()

    await expect(page.getByRole("link", { name: /Slow English Stories/ })).toBeVisible()
  })
})