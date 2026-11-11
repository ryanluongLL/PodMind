import { test, expect } from "./support/fixtures"

test.describe("onboarding", () => {
  test("a first visit walks through setup and remembers the answers", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("dialog", { name: "Welcome to PodMind" })).toBeVisible()
    await page.getByRole("button", { name: "Get started" }).click()

    await expect(page.getByRole("dialog", { name: "What's your native language?" })).toBeVisible()
    const spanish = page.getByRole("button", { name: /Español/ })
    await spanish.click()
    await expect(spanish).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page.getByRole("dialog", { name: "How well do you understand spoken English?" })).toBeVisible()
    await page.getByRole("button", { name: /B2 · Upper intermediate/ }).click()
    await page.getByRole("button", { name: "30 min" }).click()
    await page.getByRole("button", { name: "Start learning" }).click()

    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText("0 of 30 min today")).toBeVisible()

    /// A returning visit skips onboarding and keeps the choices
    await page.reload()
    await expect(page.getByRole("heading", { name: "Your library" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    const profile = await page.evaluate(() => JSON.parse(window.localStorage.getItem("podmind:profile") ?? "{}"))
    expect(profile).toMatchObject({ nativeLanguage: "es", englishLevel: "B2", dailyGoalMinutes: 30, onboarded: true })
  })

  test("going back keeps the answer already picked", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Get started" }).click()
    await page.getByRole("button", { name: /日本語/ }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("button", { name: "Back" }).click()

    await expect(page.getByRole("button", { name: /日本語/ })).toHaveAttribute("aria-pressed", "true")
  })
})