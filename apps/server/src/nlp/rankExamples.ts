/// Pure ranking for example sentences: no database, no NLP library. The
/// lemmatizer is passed in, so tests can use a simple fake and the real code
/// passes wink-nlp's lemmatizeText.

export interface ExampleSentence {
  text: string
  episodeId: string
  episodeTitle: string
  podcastName: string
  start: number
  audioUrl: string | null
  iconUrl: string | null
}

export interface CandidateRow {
  text: string
  episode_id: string
  episode_title: string
  podcast_name: string
  start: number
  audio_url: string | null
  icon_url: string | null
}

export interface RankOptions {
  lemma: string
  currentSentence: string
  currentEpisodeId: string | null
  senseSignature: Set<string>
  limit: number
  lemmatize: (text: string) => string[]
}

export const MIN_GOOD_LENGTH = 6
export const MAX_GOOD_LENGTH = 25

/// Scores each candidate by how well it fits the chosen meaning, its length,
/// and whether it comes from a different episode than the one being read,
/// then returns the best ones. Equal scores keep their database order.
export function rankExamples(rows: CandidateRow[], options: RankOptions): ExampleSentence[] {
  const current = options.currentSentence.trim().toLowerCase()
  const seen = new Set<string>()
  const scored: { example: ExampleSentence; score: number }[] = []

  for (const row of rows) {
    const text = row.text.trim()
    const key = text.toLowerCase()

    /// Skip the sentence the learner is already looking at, and duplicates
    if (key.length === 0 || key === current || seen.has(key)) {
      continue
    }
    seen.add(key)

    let score = 0

    /// Fit with the chosen meaning: shared words with the sense signature
    for (const word of new Set(options.lemmatize(text))) {
      if (word !== options.lemma && options.senseSignature.has(word)) {
        score += 1
      }
    }

    /// Readable length
    const wordCount = text.split(/\s+/).length
    if (wordCount >= MIN_GOOD_LENGTH && wordCount <= MAX_GOOD_LENGTH) {
      score += 1
    }

    /// Variety: prefer other episodes
    if (options.currentEpisodeId !== null && row.episode_id !== options.currentEpisodeId) {
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

  /// Array sort is stable, so ties keep their original order
  scored.sort((a, b) => b.score - a.score)

  const result: ExampleSentence[] = []
  for (let i = 0; i < scored.length && i < options.limit; i++) {
    const item = scored[i]
    if (item) {
      result.push(item.example)
    }
  }
  return result
}