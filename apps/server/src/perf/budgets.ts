/// Speed limits for the busiest API routes. The load test sends steady
/// traffic to each route and fails if the slowest 10% of requests (p90) take
/// longer than the budget, or if any request fails.
///
/// The load test fills the database to a realistic size first (200 podcasts,
/// 2,001 transcribed episodes). Measured p90 times on that data were about
/// 3ms, 16ms, 6ms, and 25ms, and each budget allows roughly 5 times that,
/// because CI machines are slower and noisier than a laptop.
///
/// The budgets catch real slowdowns, such as a missing index or a query
/// inside a loop, not normal noise. A per podcast query in the library list
/// (N+1) took it from 16ms to 247ms, which fails clearly. Raising a budget
/// should be a deliberate change in a pull request, with a reason.

export interface RouteBudget {
  name: string
  method: "GET" | "POST"
  /// Built from the seeded podcast, since some paths need its id
  path: (seed: { podcastId: string; episodeId: string }) => string
  body?: unknown
  p90Ms: number
}

export const ROUTE_BUDGETS: RouteBudget[] = [
  {
    name: "Health check",
    method: "GET",
    path: () => "/health",
    p90Ms: 25,
  },
  {
    name: "Library list",
    method: "GET",
    path: () => "/podcasts",
    p90Ms: 80,
  },
  {
    name: "Podcast page with transcripts",
    method: "GET",
    path: (seed) => `/podcasts/${seed.podcastId}`,
    p90Ms: 50,
  },
  {
    name: "Word lookup (cached translation)",
    method: "POST",
    path: () => "/translate",
    body: { word: "bank", targetLang: "es", context: "Today I need to deposit money at the bank." },
    p90Ms: 120,
  },
]

/// Parallel connections and seconds per route. PERF_DURATION shortens or
/// lengthens a run without editing this file.
export const CONNECTIONS = 10
export const DURATION_SECONDS = Number(process.env.PERF_DURATION ?? 10)