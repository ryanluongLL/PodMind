import { pool } from '../db/index.js'
import { lemmatizeText, type WordNetPos } from './tagger.js'

export interface SenseRow {
  id: number
  lemma: string
  pos: string
  sense_rank: number
  definition: string
  examples: string[]
}

export interface ScoredSense extends SenseRow {
  score: number
  overlap: string[]
}

// Scoring weights. Each matched context word is worth between 0.1 and 1 point
// depending on how rare it is, so these stay in proportion: they steer ties
// and weak evidence, while one or two strong matches can still override a
// wrong POS tag or a less common meaning.
const POS_BONUS = 1
const RANK_PRIOR = 1
const FREQUENCY_LIST_SIZE = 50000
const MIN_WORD_WEIGHT = 0.1

async function fetchSenses(lemma: string): Promise<SenseRow[]> {
  const { rows } = await pool.query<SenseRow>(
    `SELECT id, lemma, pos, sense_rank, definition, examples
     FROM dictionary_senses
     WHERE lemma = $1
     ORDER BY sense_rank`,
    [lemma]
  )
  return rows
}

// Looks up frequency ranks for all context words in one query and turns each
// into a weight. Common words like "go" carry little evidence about meaning,
// rare words like "paycheck" carry a lot. Words missing from the list are
// rarer than anything in it, so they get the full weight.
async function fetchWordWeights(words: string[]): Promise<Map<string, number>> {
  const weights = new Map<string, number>()
  if (words.length === 0) {
    return weights
  }

  const { rows } = await pool.query<{ word: string; rank: number }>(
    `SELECT word, rank FROM word_frequency WHERE word = ANY($1)`,
    [words]
  )

  const ranks = new Map<string, number>()
  for (const row of rows) {
    ranks.set(row.word, row.rank)
  }

  for (const word of words) {
    const rank = ranks.get(word)
    if (rank === undefined) {
      weights.set(word, 1)
    } else {
      const weight = Math.log(rank) / Math.log(FREQUENCY_LIST_SIZE)
      weights.set(word, Math.max(MIN_WORD_WEIGHT, Math.min(1, weight)))
    }
  }

  return weights
}

// Weighted Lesk word sense disambiguation, extended with a part of speech
// bonus and a frequency prior. Returns every sense for the word, best first.
export async function disambiguate(
  lemma: string,
  wordnetPos: WordNetPos | null,
  contextLemmas: string[],
  surface: string
): Promise<ScoredSense[]> {
  let senses = await fetchSenses(lemma)

  // If the lemmatizer produced a form WordNet doesn't know, try the word as
  // it appeared in the transcript.
  if (senses.length === 0 && surface.toLowerCase() !== lemma) {
    senses = await fetchSenses(surface.toLowerCase())
  }

  // Unique context words, minus the target itself. A word matching its own
  // definition says nothing about which meaning is intended.
  const context: string[] = []
  for (const word of contextLemmas) {
    if (word === lemma || word.length <= 1) {
      continue
    }
    if (!context.includes(word)) {
      context.push(word)
    }
  }

  const weights = await fetchWordWeights(context)

  const scored: ScoredSense[] = []
  for (const sense of senses) {
    const signatureText = `${sense.definition} ${sense.examples.join(' ')}`
    const signature = new Set(lemmatizeText(signatureText))

    const overlap: string[] = []
    let overlapScore = 0
    for (const word of context) {
      if (signature.has(word)) {
        overlap.push(word)
        overlapScore += weights.get(word) ?? 1
      }
    }

    let score = overlapScore + RANK_PRIOR / sense.sense_rank
    if (wordnetPos !== null && sense.pos === wordnetPos) {
      score += POS_BONUS
    }

    scored.push({ ...sense, score, overlap })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored
}