import { spawn, type ChildProcess } from "node:child_process"
import autocannon from "autocannon"
import { ROUTE_BUDGETS, CONNECTIONS, DURATION_SECONDS, type RouteBudget } from "./budgets.js"

/// API performance budgets. Runs against the end to end server (real API,
/// fresh database, fake DeepL), so results never depend on the internet.
/// If that server is not running yet, this script starts it and stops it
/// at the end. Run with "npm run perf:api" from the repo root.

const API_URL = "http://localhost:3101"
const FAKES_URL = "http://localhost:3102"
const STARTUP_TIMEOUT_MS = 60_000

/// Library size for the test: 200 podcasts with 10 transcribed episodes each.
/// Many podcasts make a per podcast query (N+1) clearly slow, while correct
/// code stays fast.
const BULK_PODCASTS = 200
const BULK_EPISODES_EACH = 10

interface Measured {
  budget: RouteBudget
  p50: number
  p90: number
  requestsPerSecond: number
  failures: number
}

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

async function startServerIfNeeded(): Promise<ChildProcess | null> {
  if (await isUp()) {
    console.log("[perf] using the end to end server that is already running")
    return null
  }
  console.log("[perf] starting the end to end server")
  /// One plain Node process with tsx loaded, so stopping it at the end
  /// really stops it (a shell in between would leave the server running).
  /// Its normal output is hidden: the server logs every request, and
  /// thousands of log lines would bury the results and slow the requests
  /// being measured. Errors still show.
  const child = spawn(process.execPath, ["--import", "tsx", "src/e2e/server.ts"], {
    stdio: ["ignore", "ignore", "inherit"],
  })
  const startedAt = Date.now()
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await isUp()) {
      return child
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  child.kill()
  throw new Error("The end to end server did not start within 60 seconds")
}

async function seed(): Promise<{ podcastId: string; episodeId: string }> {
  const reset = await fetch(`${FAKES_URL}/__reset`, { method: "POST" })
  if (!reset.ok) {
    throw new Error("Could not reset the end to end database")
  }
  const bulk = await fetch(
    `${FAKES_URL}/__seed/bulk?podcasts=${BULK_PODCASTS}&episodes=${BULK_EPISODES_EACH}`,
    { method: "POST" }
  )
  if (!bulk.ok) {
    throw new Error("Could not fill the library for the load test")
  }
  const res = await fetch(`${FAKES_URL}/__seed/transcribed-episode`, { method: "POST" })
  return (await res.json()) as { podcastId: string; episodeId: string }
}

async function measure(budget: RouteBudget, seedIds: { podcastId: string; episodeId: string }): Promise<Measured> {
  const url = `${API_URL}${budget.path(seedIds)}`
  const headers: Record<string, string> = {}
  let body: string | undefined
  if (budget.body !== undefined) {
    headers["content-type"] = "application/json"
    body = JSON.stringify(budget.body)
  }

  /// One request first, so one time setup (like filling the translation
  /// cache) is not counted as a slow request
  await fetch(url, { method: budget.method, headers, body: body ?? null })

  const options: autocannon.Options = {
    url,
    method: budget.method,
    headers,
    connections: CONNECTIONS,
    duration: DURATION_SECONDS,
  }
  if (body !== undefined) {
    options.body = body
  }
  const result = await autocannon(options)

  return {
    budget,
    p50: result.latency.p50,
    p90: result.latency.p90,
    requestsPerSecond: Math.round(result.requests.average),
    failures: result.errors + result.timeouts + result.non2xx,
  }
}

function report(results: Measured[]): boolean {
  let allPassed = true
  console.log("")
  console.log(
    `[perf] ${BULK_PODCASTS} podcasts, ${BULK_PODCASTS * BULK_EPISODES_EACH + 1} transcribed episodes, ` +
      `${CONNECTIONS} connections, ${DURATION_SECONDS}s per route`
  )
  console.log("")
  for (const r of results) {
    const passed = r.p90 <= r.budget.p90Ms && r.failures === 0
    if (!passed) {
      allPassed = false
    }
    let status = "PASS"
    if (!passed) {
      status = "FAIL"
    }
    console.log(
      `${status}  ${r.budget.name.padEnd(34)} p50 ${String(r.p50).padStart(4)}ms  ` +
        `p90 ${String(r.p90).padStart(4)}ms (budget ${r.budget.p90Ms}ms)  ` +
        `${String(r.requestsPerSecond).padStart(5)} req/s  failures ${r.failures}`
    )
  }
  console.log("")
  return allPassed
}

const child = await startServerIfNeeded()
let exitCode = 0
try {
  const seedIds = await seed()
  const results: Measured[] = []
  for (const budget of ROUTE_BUDGETS) {
    results.push(await measure(budget, seedIds))
  }
  if (!report(results)) {
    console.error("[perf] at least one route is over its budget")
    exitCode = 1
  }
} catch (err) {
  console.error("[perf] load test failed", err)
  exitCode = 1
} finally {
  if (child) {
    child.kill()
  }
}
process.exit(exitCode)