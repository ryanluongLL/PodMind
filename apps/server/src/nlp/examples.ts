import { pool } from "../db/index.js"
import { lemmatizeText } from "./tagger.js"
import { inflectionPattern } from "./inflections.js"
import { rankExamples, type CandidateRow, type ExampleSentence } from "./rankExamples.js"

export type { ExampleSentence } from "./rankExamples.js"

const CANDIDATE_LIMIT = 60

/// Finds real sentences from transcribed episodes that use the word, then
/// ranks them with rankExamples. This file only does the database query;
/// the matching and scoring rules live in unit tested pure modules.
export async function findExamples(
  lemma: string,
  surface: string,
  currentSentence: string,
  currentEpisodeId: string | null,
  senseSignature: Set<string>,
  limit: number = 3
): Promise<ExampleSentence[]> {
  const pattern = inflectionPattern(lemma, surface)
  if (pattern === null) {
    return []
  }

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

  return rankExamples(rows, {
    lemma: lemma.toLowerCase(),
    currentSentence,
    currentEpisodeId,
    senseSignature,
    limit,
    lemmatize: lemmatizeText,
  })
}