// Flesch-Kincaid based CEFR estimator. No external API calls.
// Counts syllables with a standard vowel-group heuristic, then combines
// average sentence length and average syllables/word into the classic
// Flesch Reading Ease score, and maps that score onto CEFR bands.
// Words-per-minute (already computed from Whisper timestamps) nudges
// the result up or down a notch, since speaking speed is a real
// difficulty signal that text alone does not capture.

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '')
  if (cleaned.length === 0) return 0
  if (cleaned.length <= 3) return 1

  const withoutTrailingE = cleaned.replace(/e$/, '')
  const vowelGroups = withoutTrailingE.match(/[aeiouy]+/g)
  const count = vowelGroups ? vowelGroups.length : 1
  return Math.max(count, 1)
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function splitWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}

export interface ReadabilityResult {
  level: string
  fleschScore: number
  avgSentenceLength: number
  avgSyllablesPerWord: number
  reason: string
}

export function estimateDifficulty(text: string, wordsPerMinute: number): ReadabilityResult {
  const sentences = splitSentences(text)
  const words = splitWords(text)

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0)

  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : words.length
  const avgSyllablesPerWord = words.length > 0 ? totalSyllables / words.length : 0

  // Standard Flesch Reading Ease formula. Higher score = easier text.
  const fleschScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord

  // Base CEFR band from the Flesch score, calibrated against typical
  // spoken-English podcast transcripts (which score higher/easier than
  // formal writing at the same real difficulty, since speech is looser).
  let level: string
  if (fleschScore >= 80) level = 'A2'
  else if (fleschScore >= 65) level = 'B1'
  else if (fleschScore >= 50) level = 'B2'
  else if (fleschScore >= 35) level = 'C1'
  else level = 'C2'

  // Speaking speed nudges the level up or down one band, since two
  // transcripts with identical vocabulary can differ a lot in how hard
  // they are to follow by ear.
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  let idx = levels.indexOf(level)
  if (wordsPerMinute > 0) {
    if (wordsPerMinute < 110 && idx > 0) idx -= 1
    if (wordsPerMinute > 165 && idx < levels.length - 1) idx += 1
  }
  level = levels[idx]!

  const reason = `Flesch score ${fleschScore.toFixed(0)} (avg ${avgSentenceLength.toFixed(1)} words/sentence, ${avgSyllablesPerWord.toFixed(2)} syllables/word), ${wordsPerMinute} wpm speaking speed.`

  return { level, fleschScore, avgSentenceLength, avgSyllablesPerWord, reason }
}