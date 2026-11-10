/// Pure helpers for Discover previews: no network, no database. Kept separate
/// from the route so each rule can be unit tested on its own.

export interface LearnerFit {
  level: "great" | "good" | "hard"
  label: string
  reasons: string[]
}

export const DESCRIPTION_MAX_CHARS = 240
export const STALE_AFTER_DAYS = 90

/// The server downloads URLs that come from the browser, so only allow public
/// http(s) addresses. This blocks the common ways of pointing the server at its
/// own machine or private network. It does not cover every trick (such as a
/// public hostname that resolves to a private address), so it is a basic guard.
export function isAllowedFeedUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) {
    return false
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return false
  }
  if (host.startsWith("[")) {
    return false
  }
  return true
}

/// itunes:duration comes as seconds ("754"), "MM:SS", or "HH:MM:SS"
export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const text = String(value).trim()
  if (text.length === 0) {
    return null
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(parseFloat(text))
  }
  const parts = text.split(":").map(Number)
  if (parts.length > 3 || parts.some((p) => Number.isNaN(p))) {
    return null
  }
  let seconds = 0
  for (const part of parts) {
    seconds = seconds * 60 + part
  }
  return seconds
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? null
}

/// Feed descriptions are often HTML. Strip tags, decode the common entities,
/// and keep whole sentences up to a length that fits a card.
export function cleanDescription(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

  if (text.length <= DESCRIPTION_MAX_CHARS) {
    return text
  }

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)
  let result = ""
  if (sentences) {
    for (const sentence of sentences) {
      if (result.length > 0 && (result + sentence).length > DESCRIPTION_MAX_CHARS) {
        break
      }
      result += sentence
    }
  }

  /// No sentence break early enough: cut at the last full word instead
  if (result.trim().length === 0 || result.length > DESCRIPTION_MAX_CHARS) {
    const cut = text.slice(0, DESCRIPTION_MAX_CHARS)
    const lastSpace = cut.lastIndexOf(" ")
    let end = cut.length
    if (lastSpace > 0) {
      end = lastSpace
    }
    return `${cut.slice(0, end)}...`
  }
  return result.trim()
}

/// The release schedule word on its own: "daily", "weekly", and so on.
/// Null when episodes are too far apart to call it a schedule.
export function cadenceWord(gapDays: number): string | null {
  if (gapDays <= 1.5) {
    return "daily"
  }
  if (gapDays <= 4) {
    return "several times a week"
  }
  if (gapDays <= 8) {
    return "weekly"
  }
  if (gapDays <= 16) {
    return "every two weeks"
  }
  if (gapDays <= 35) {
    return "about monthly"
  }
  return null
}

export function cadenceLabel(gapDays: number): string {
  const word = cadenceWord(gapDays)
  if (word === null) {
    return "Irregular schedule"
  }
  return `New episodes ${word}`
}

/// "45 days ago", "5 months ago", "1 year ago"
export function timeAgo(days: number): string {
  if (days < 60) {
    return `${days} days ago`
  }
  if (days < 365) {
    return `${Math.round(days / 30)} months ago`
  }
  const years = Math.round(days / 365)
  if (years === 1) {
    return "1 year ago"
  }
  return `${years} years ago`
}

export interface FitInput {
  genre: string
  medianMinutes: number | null
  gapDays: number | null
  daysSinceLast: number | null
  isEnglish: boolean | null
}

/// Rule based learner fit. Short episodes are easier to finish and re-listen
/// to, a regular schedule builds a habit, and shows made for learners speak
/// more clearly. Every point added or removed is explained in reasons.
///
/// The schedule is measured from the gaps between past episodes, so it says
/// how often a show used to publish. If the show has gone quiet, the reason
/// says so in one line instead of claiming a schedule that no longer holds,
/// and the schedule bonus is not given.
export function scoreFit(input: FitInput): LearnerFit {
  if (input.isEnglish === false) {
    return {
      level: "hard",
      label: "Not in English",
      reasons: ["The feed says this show is in another language"],
    }
  }

  let score = 0
  const reasons: string[] = []

  if (input.genre.toLowerCase().includes("language")) {
    score += 2
    reasons.push("Made for language learners")
  }

  if (input.medianMinutes !== null) {
    if (input.medianMinutes <= 15) {
      score += 2
      reasons.push(`Short episodes, about ${input.medianMinutes} min`)
    } else if (input.medianMinutes <= 35) {
      score += 1
      reasons.push(`Episodes about ${input.medianMinutes} min`)
    } else {
      reasons.push(`Long episodes, about ${input.medianMinutes} min`)
    }
  }

  const isStale = input.daysSinceLast !== null && input.daysSinceLast > STALE_AFTER_DAYS

  if (isStale && input.daysSinceLast !== null) {
    score -= 1
    let word: string | null = null
    if (input.gapDays !== null) {
      word = cadenceWord(input.gapDays)
    }
    if (word !== null) {
      reasons.push(`Was ${word}, last episode ${timeAgo(input.daysSinceLast)}`)
    } else {
      reasons.push(`Last episode ${timeAgo(input.daysSinceLast)}`)
    }
  } else if (input.gapDays !== null && input.gapDays <= 8) {
    score += 1
    reasons.push(cadenceLabel(input.gapDays))
  }

  if (score >= 3) {
    return { level: "great", label: "Great for learners", reasons }
  }
  if (score >= 1) {
    return { level: "good", label: "Good for learners", reasons }
  }
  return { level: "hard", label: "Harder for learners", reasons }
}