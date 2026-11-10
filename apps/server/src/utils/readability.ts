/// Flesch Kincaid based CEFR estimator. No external API calls.
/// Counts syllables with a standard vowel group heuristic, then combines
/// average sentence length and average syllables per word into the classic
/// Flesch Reading Ease score, and maps that score onto CEFR bands.
/// Words per minute (computed from Whisper timestamps) nudges the result up
/// or down one band, since speaking speed is a real difficulty signal that
/// text alone does not capture.

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

const SLOW_WPM = 110
const FAST_WPM = 165

/// Vowel group heuristic. Not exact for every word (for example "people"
/// counts as 1), but accurate enough on average across a whole transcript.
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "")
  if (cleaned.length === 0) {
    return 0
  }
  if (cleaned.length <= 3) {
    return 1
  }

  const withoutTrailingE = cleaned.replace(/e$/, "")
  const vowelGroups = withoutTrailingE.match(/[aeiouy]+/g)
  let count = 1
  if (vowelGroups) {
    count = vowelGroups.length
  }
  return Math.max(count, 1)
}

export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function splitWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}

/// Base CEFR band from the Flesch score, calibrated against spoken podcast
/// transcripts, which score easier than formal writing at the same real
/// difficulty because speech is looser.
export function levelFromFlesch(score: number): CefrLevel {
  if (score >= 80) {
    return "A2"
  }
  if (score >= 65) {
    return "B1"
  }
  if (score >= 50) {
    return "B2"
  }
  if (score >= 35) {
    return "C1"
  }
  return "C2"
}

/// Slow speech moves the level down one band, fast speech moves it up one.
/// Two transcripts with identical words can differ a lot in how hard they are
/// to follow by ear. A wpm of 0 means unknown and leaves the level alone.
export function adjustForSpeed(level: CefrLevel, wordsPerMinute: number): CefrLevel {
  let index = CEFR_LEVELS.indexOf(level)
  if (wordsPerMinute > 0) {
    if (wordsPerMinute < SLOW_WPM && index > 0) {
      index -= 1
    }
    if (wordsPerMinute > FAST_WPM && index < CEFR_LEVELS.length - 1) {
      index += 1
    }
  }
  return CEFR_LEVELS[index] ?? level
}

export interface TimedSegment {
  start: number
  end: number
  text: string
}

/// Speaking speed from Whisper segments: words in the transcript divided by
/// the minutes up to the end of the last segment. Returns 0 (unknown) when
/// there are no segments or no usable timing.
export function wordsPerMinute(fullText: string, segments: TimedSegment[] | null): number {
  if (!segments || segments.length === 0) {
    return 0
  }
  const lastSegment = segments[segments.length - 1]
  const durationMinutes = (lastSegment?.end ?? 0) / 60
  if (durationMinutes <= 0) {
    return 0
  }
  return Math.round(splitWords(fullText).length / durationMinutes)
}

export interface ReadabilityResult {
  level: CefrLevel
  fleschScore: number
  avgSentenceLength: number
  avgSyllablesPerWord: number
  reason: string
}

export function estimateDifficulty(text: string, wordsPerMinute: number): ReadabilityResult {
  const sentences = splitSentences(text)
  const words = splitWords(text)

  let totalSyllables = 0
  for (const word of words) {
    totalSyllables += countSyllables(word)
  }

  let avgSentenceLength = words.length
  if (sentences.length > 0) {
    avgSentenceLength = words.length / sentences.length
  }

  let avgSyllablesPerWord = 0
  if (words.length > 0) {
    avgSyllablesPerWord = totalSyllables / words.length
  }

  /// Standard Flesch Reading Ease formula. Higher score means easier text.
  const fleschScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord

  const level = adjustForSpeed(levelFromFlesch(fleschScore), wordsPerMinute)

  const reason = `Flesch score ${fleschScore.toFixed(0)} (avg ${avgSentenceLength.toFixed(1)} words/sentence, ${avgSyllablesPerWord.toFixed(2)} syllables/word), ${wordsPerMinute} wpm speaking speed.`

  return { level, fleschScore, avgSentenceLength, avgSyllablesPerWord, reason }
}