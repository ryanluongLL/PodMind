import { defineConfig, devices } from "@playwright/test"

/// End to end tests: a real Chromium drives the real web app, which talks to
/// the real API on a fresh database. DeepL and the podcast feed are local
/// fakes, and every request to the internet is blocked, so runs are free,
/// repeatable, and work offline. Run with "npm run test:e2e" from the root.

const WEB_PORT = 3100
const API_PORT = 3101
const isCI = Boolean(process.env.CI)

/// CI retries a failed test once and keeps the trace of the failure.
/// Locally there are no retries, so a flaky test is noticed right away.
let retries = 0
let reporter: "list" | [string, Record<string, unknown>][] = "list"
if (isCI) {
  retries = 1
  reporter = [["list", {}], ["html", { open: "never" }]]
}

/// Only needed where Playwright's own Chromium cannot be installed. Video
/// recording needs the ffmpeg that comes with Playwright's browsers, so it
/// is turned off in that case.
const launchOptions: { executablePath?: string } = {}
let video: "retain-on-failure" | "off" = "retain-on-failure"
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  video = "off"
}

export default defineConfig({
  testDir: "./e2e",
  /// Tests share one database, so they run one at a time
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries,
  reporter,
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
  ],
  webServer: [
    {
      /// API plus fake DeepL and feed, on the podmind_e2e_test database
      command: "npm run e2e:server --workspace server",
      cwd: "../..",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      /// A production build, the same kind of build users get
      command: `npm run build && npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: !isCI,
      timeout: 240_000,
    },
  ],
})