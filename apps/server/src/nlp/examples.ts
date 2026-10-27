import { pool } from '../db/index.js'
import { lemmatizeText } from './tagger.js'

export interface ExampleSentence {
  text: string
  episodeId: string
  episodeTitle: string
  podcastName: string
  start: number
  audioUrl: string | null
  iconUrl: string | null
}

interface CandidateRow {
  text: string
  episode_id: string
  episode_title: string
  podcast_name: string
  start: number
  audio_url: string | null
  icon_url: string | null
}

const CANDIDATE_LIMIT = 60
const MIN_GOOD_LENGTH = 6
const MAX_GOOD_LENGTH = 25

// Generates the common inflected forms of a word so a search for "disciple"
// also finds "disciples", and "carry" also finds "carries" and "carried".
// This is intentionally simple: it covers regular English inflection, and
// the surface form the learner clicked is always included as well.
function inflections(lemma: string, surface: string): string[] {
  const forms = new Set<string>()
  forms.add(lemma)
  forms.add(surface.toLowerCase())
  forms.add(`${lemma}s`)
  forms.add(`${lemma}es`)
  forms.add(`${lemma}ed`)
  forms.add(`${lemma}d`)
  forms.add(`${lemma}ing`)

  if (lemma.endsWith('e')) {
    forms.add(`${lemma.slice(0, -1)}ing`)
  }

  if (/[^aeiou]y$/.test(lemma)) {
    const stem = lemma.slice(0, -1)
    forms.add(`${stem}ies`)
    forms.add(`${stem}ied`)
  }

  const clean: string[] = []
  for (const form of forms) {
    if (/^[a-z'-]+$/.test(form)) {
      clean.push(form)
    }
  }
  return clean
}

// Finds real sentences from transcribed episodes that use the word, then
// ranks them by how well they fit the chosen meaning, their length, and
// whether they come from a different episode than the one being read.
export async function findExamples(
  lemma: string,
  surface: string,
  currentSentence: string,
  currentEpisodeId: string | null,
  senseSignature: Set<string>,
  limit: number = 3
): Promise<ExampleSentence[]> {
  const forms = inflections(lemma, surface)
  if (forms.length === 0) {
    return []
  }

  // \m and \M are Postgres regex word boundaries, so "run" does not match "brunch".
  const pattern = `\\m(${forms.join('|')})\\M`

  const { rows } = await pool.query<CandidateRow>(
    `SELECT seg->>'text' AS text,
            e.id AS episode_id,
            e.title AS episode_title,
            p.name AS podcast_name,
            (seg->>'start')::float AS start,
            e.audio_url AS audio_url,
            COALESCE(e.icon_url, p.icon_url) AS icon_url
     FROM transcripts t
     JOIN episodes e ON e.id = t.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     CROSS JOIN LATERAL jsonb_array_elements(t.segments) AS seg
     WHERE t.status = 'done'
       AND seg->>'text' ~* $1
     LIMIT $2`,
    [pattern, CANDIDATE_LIMIT]
  )

  const current = currentSentence.trim().toLowerCase()
  const seen = new Set<string>()
  const scored: { example: ExampleSentence; score: number }[] = []

  for (const row of rows) {
    const text = row.text.trim()
    const key = text.toLowerCase()

    // Skip the sentence the learner is already looking at, and duplicates.
    if (key === current || seen.has(key)) {
      continue
    }
    seen.add(key)

    let score = 0

    // Fit with the chosen meaning: shared words with the sense signature.
    const words = lemmatizeText(text)
    for (const word of new Set(words)) {
      if (word !== lemma && senseSignature.has(word)) {
        score += 1
      }
    }

    // Readable length.
    const wordCount = text.split(/\s+/).length
    if (wordCount >= MIN_GOOD_LENGTH && wordCount <= MAX_GOOD_LENGTH) {
      score += 1
    }

    // Variety: prefer other episodes.
    if (currentEpisodeId !== null && row.episode_id !== currentEpisodeId) {
      score += 0.5
    }

    scored.push({
      example: {
        text,
        episodeId: row.episode_id,
        episodeTitle: row.episode_title,
        podcastName: row.podcast_name,
        start: row.start,
        audioUrl: row.audio_url,
        iconUrl: row.icon_url,
      },
      score,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  const result: ExampleSentence[] = []
  for (let i = 0; i < scored.length && i < limit; i++) {
    const item = scored[i]
    if (item) {
      result.push(item.example)
    }
  }
  return result
}