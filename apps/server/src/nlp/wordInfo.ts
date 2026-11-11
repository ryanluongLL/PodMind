/// Pure helpers for the word popup: request checks, rarity bands, part of
/// speech labels, and picking runner up meanings. No database, no network.

/// The native languages offered in onboarding. Anything else is rejected
/// before it can reach DeepL or the translation cache.
export const SUPPORTED_TARGET_LANGS = ["vi", "es", "zh", "ko", "ja", "pt"] as const
export type TargetLang = (typeof SUPPORTED_TARGET_LANGS)[number]

export const MAX_WORD_LENGTH = 40
export const MAX_CONTEXT_LENGTH = 600

export interface TranslateRequest {
  word: string
  targetLang: TargetLang
  sentence: string
  episodeId: string | null
}

export type CheckResult = { ok: true; value: TranslateRequest } | { ok: false; error: string }

function isTargetLang(value: string): value is TargetLang {
  return (SUPPORTED_TARGET_LANGS as readonly string[]).includes(value)
}

/// Checks the body of POST /translate. A long context is cut down rather
/// than rejected, since it only helps pick a meaning; a long "word" is
/// rejected, since every character of it is sent to DeepL.
export function checkTranslateRequest(body: unknown): CheckResult {
  const input = (body ?? {}) as Record<string, unknown>
  const word = typeof input.word === "string" ? input.word.trim() : ""
  const targetLang = typeof input.targetLang === "string" ? input.targetLang : ""

  if (word.length === 0 || targetLang.length === 0) {
    return { ok: false, error: "word and targetLang are required" }
  }
  if (word.length > MAX_WORD_LENGTH) {
    return { ok: false, error: `word must be at most ${MAX_WORD_LENGTH} characters` }
  }
  if (!isTargetLang(targetLang)) {
    return { ok: false, error: `targetLang must be one of ${SUPPORTED_TARGET_LANGS.join(", ")}` }
  }

  let sentence = word
  if (typeof input.context === "string" && input.context.trim().length > 0) {
    sentence = input.context.trim().slice(0, MAX_CONTEXT_LENGTH)
  }

  let episodeId: string | null = null
  if (typeof input.episodeId === "string" && input.episodeId.length > 0) {
    episodeId = input.episodeId
  }

  return { ok: true, value: { word, targetLang, sentence, episodeId } }
}

export interface Rarity {
  rank: number | null
  band: "very common" | "common" | "less common" | "rare"
  label: string
}

/// Bands follow common vocabulary research: knowing the top 3,000 words
/// covers most everyday speech. Words missing from the list count as rare.
export function rarityForRank(rank: number | null): Rarity {
  if (rank !== null && rank <= 1000) {
    return { rank, band: "very common", label: "One of the 1,000 most used words in spoken English." }
  }
  if (rank !== null && rank <= 3000) {
    return { rank, band: "common", label: "One of the 3,000 most used words. Worth learning early." }
  }
  if (rank !== null && rank <= 10000) {
    return { rank, band: "less common", label: "Less common. Useful once you know the basics." }
  }
  return { rank, band: "rare", label: "Rare in everyday speech. Often specialized or formal." }
}

/// Part of speech for WordNet senses (used when Lesk picked a meaning)
const SENSE_POS_LABELS: Record<string, string> = {
  n: "noun",
  v: "verb",
  a: "adjective",
  s: "adjective",
  r: "adverb",
}

/// Part of speech for wink-nlp tags (used for words WordNet does not cover,
/// like "the" or "because")
const TAG_POS_LABELS: Record<string, string> = {
  NOUN: "noun",
  PROPN: "proper noun",
  VERB: "verb",
  AUX: "verb",
  ADJ: "adjective",
  ADV: "adverb",
  PRON: "pronoun",
  ADP: "preposition",
  CCONJ: "conjunction",
  SCONJ: "conjunction",
  DET: "determiner",
  NUM: "number",
  INTJ: "interjection",
  PART: "particle",
}

export function senseLabel(sensePos: string): string {
  return SENSE_POS_LABELS[sensePos] ?? ""
}

/// The chosen meaning's part of speech wins; the tagger's guess is the fallback
export function partOfSpeechLabel(tagPos: string, sensePos: string | null): string {
  const fromTag = TAG_POS_LABELS[tagPos] ?? ""
  if (sensePos === null) {
    return fromTag
  }
  const fromSense = senseLabel(sensePos)
  if (fromSense.length > 0) {
    return fromSense
  }
  return fromTag
}

export interface OtherMeaning {
  partOfSpeech: string
  definition: string
}

/// Up to "max" runner up meanings after the best one. WordNet often lists the
/// same wording under several senses, so repeated definitions are skipped.
export function pickOtherMeanings(
  ranked: { pos: string; definition: string }[],
  max: number = 2
): OtherMeaning[] {
  const seen = new Set<string>()
  const first = ranked[0]
  if (first) {
    seen.add(first.definition)
  }
  const result: OtherMeaning[] = []
  for (let i = 1; i < ranked.length && result.length < max; i++) {
    const sense = ranked[i]
    if (!sense || seen.has(sense.definition)) {
      continue
    }
    seen.add(sense.definition)
    result.push({ partOfSpeech: senseLabel(sense.pos), definition: sense.definition })
  }
  return result
}