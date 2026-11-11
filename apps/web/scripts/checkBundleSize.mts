import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

/// JavaScript size budgets. After "next build", adds up the JavaScript the
/// browser downloads to open each page, compressed with gzip the way it is
/// sent over the network, and fails if a page goes over its limit. This
/// catches a heavy new library or an accidental import of server code before
/// it slows down every learner's first visit.
///
/// Run with "npm run perf:bundle" after a build.

/// Limits in KB of gzipped JavaScript. Measured sizes were 188 to 197 KB per
/// page: about 107 KB is React and the Next.js runtime that every Next app
/// ships, about 54 KB is the shared layout (React Query, toasts, the audio
/// player, icons), and the rest is each page's own code. The limit leaves
/// about 12% room for normal growth, so going over means something big was
/// added. Old browser polyfills are not counted, since modern browsers skip
/// them.
const DEFAULT_BUDGET_KB = 220
const ROUTE_BUDGETS_KB: Record<string, number> = {}

const NEXT_DIR = ".next"

interface RouteSize {
  route: string
  files: number
  gzipKb: number
  budgetKb: number
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(NEXT_DIR, file), "utf8")) as T
}

/// Each page's client manifest lists the JavaScript files for its layout and
/// the page itself. The file sets a global, so the object is cut out of it.
function entryFiles(pagePath: string): Record<string, string[]> {
  const manifest = path.join(NEXT_DIR, "server", "app", `${pagePath}_client-reference-manifest.js`)
  if (!fs.existsSync(manifest)) {
    return {}
  }
  const text = fs.readFileSync(manifest, "utf8")
  const match = /"entryJSFiles":(\{[^}]*\})/.exec(text)
  if (!match || !match[1]) {
    return {}
  }
  return JSON.parse(match[1]) as Record<string, string[]>
}

const gzipCache = new Map<string, number>()
function gzipSize(file: string): number {
  const cached = gzipCache.get(file)
  if (cached !== undefined) {
    return cached
  }
  const size = zlib.gzipSync(fs.readFileSync(path.join(NEXT_DIR, file))).length
  gzipCache.set(file, size)
  return size
}

function measureRoutes(): RouteSize[] {
  const buildManifest = readJson<{ rootMainFiles: string[] }>("build-manifest.json")
  const routes = readJson<Record<string, string>>("app-path-routes-manifest.json")
  const results: RouteSize[] = []

  for (const [pagePath, route] of Object.entries(routes)) {
    /// Only real pages, not route handlers (favicon) or Next's own error pages
    if (!pagePath.endsWith("/page") || route.startsWith("/_")) {
      continue
    }
    const files = new Set<string>(buildManifest.rootMainFiles)
    for (const [entry, list] of Object.entries(entryFiles(pagePath))) {
      if (entry.endsWith("/app/layout") || entry.endsWith(`/app${pagePath}`)) {
        for (const file of list) {
          files.add(file)
        }
      }
    }

    let bytes = 0
    for (const file of files) {
      bytes += gzipSize(file)
    }
    results.push({
      route,
      files: files.size,
      gzipKb: Math.round((bytes / 1024) * 10) / 10,
      budgetKb: ROUTE_BUDGETS_KB[route] ?? DEFAULT_BUDGET_KB,
    })
  }
  return results.sort((a, b) => a.route.localeCompare(b.route))
}

if (!fs.existsSync(path.join(NEXT_DIR, "build-manifest.json"))) {
  console.error("[bundle] no build found. Run \"npm run build\" first.")
  process.exit(1)
}

const results = measureRoutes()
let allPassed = results.length > 0
console.log("")
for (const r of results) {
  const passed = r.gzipKb <= r.budgetKb
  if (!passed) {
    allPassed = false
  }
  let status = "PASS"
  if (!passed) {
    status = "FAIL"
  }
  console.log(`${status}  ${r.route.padEnd(16)} ${String(r.gzipKb).padStart(6)} KB gzipped in ${String(r.files).padStart(2)} files (budget ${r.budgetKb} KB)`)
}
console.log("")
if (!allPassed) {
  console.error("[bundle] at least one page is over its JavaScript budget")
  process.exit(1)
}