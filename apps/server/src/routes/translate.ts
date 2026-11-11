import { Router } from "express"
import { pool } from "../db/index.js"
import { tagWordInContext, lemmatizeText } from "../nlp/tagger.js"
import { disambiguate } from "../nlp/lesk.js"
import { findExamples } from "../nlp/examples.js"
import { translateWord } from "../services/translator.js"
import {
  checkTranslateRequest,
  rarityForRank,
  partOfSpeechLabel,
  pickOtherMeanings,
  type Rarity,
} from "../nlp/wordInfo.js"

const router = Router()

/// Rarity comes from the subtitle frequency list
async function getRarity(lemma: string, surface: string): Promise<Rarity> {
  const { rows } = await pool.query<{ rank: number }>(
    `SELECT rank FROM word_frequency WHERE word = ANY($1) ORDER BY rank LIMIT 1`,
    [[lemma, surface.toLowerCase()]]
  )
  return rarityForRank(rows[0]?.rank ?? null)
}

/// Checks the Postgres cache before calling DeepL. The cache key includes the
/// WordNet sense Lesk chose, so different meanings of the same word are cached
/// separately. Returns null if DeepL fails, so the rest of the popup still
/// works, and nothing is cached, so the next click tries DeepL again.
async function getTranslation(
  surface: string,
  sentence: string,
  targetLang: string,
  cacheKey: string
): Promise<string | null> {
  const cached = await pool.query<{ translation: string }>(
    `SELECT translation FROM translation_cache WHERE word = $1 AND target_lang = $2`,
    [cacheKey, targetLang]
  )
  const hit = cached.rows[0]
  if (hit) {
    return hit.translation
  }

  try {
    const translation = await translateWord(surface, sentence, targetLang)
    await pool.query(
      `INSERT INTO translation_cache (word, target_lang, translation)
       VALUES ($1, $2, $3)
       ON CONFLICT (word, target_lang) DO NOTHING`,
      [cacheKey, targetLang, translation]
    )
    return translation
  } catch (err) {
    console.error("[translate] DeepL failed", err)
    return null
  }
}

/// POST /translate
/// Builds the word popup entirely from self owned data: context tagging,
/// weighted Lesk over WordNet, transcript examples, and the frequency list.
/// DeepL is the only external call, and it is cached.
router.post("/", async (req, res) => {
  const checked = checkTranslateRequest(req.body)
  if (!checked.ok) {
    res.status(400).json({ error: checked.error })
    return
  }
  const { word, targetLang, sentence, episodeId } = checked.value
  const startedAt = Date.now()

  try {
    const tagged = tagWordInContext(word, sentence)
    const ranked = await disambiguate(tagged.lemma, tagged.wordnetPos, tagged.contextLemmas, tagged.surface)
    const best = ranked[0] ?? null

    let signature = new Set<string>()
    let senseKey = "none"
    if (best) {
      signature = new Set(lemmatizeText(`${best.definition} ${best.examples.join(" ")}`))
      senseKey = String(best.id)
    }
    const cacheKey = `${tagged.surface.toLowerCase()}#${senseKey}`

    const [translation, rarity, examples] = await Promise.all([
      getTranslation(tagged.surface, sentence, targetLang, cacheKey),
      getRarity(tagged.lemma, tagged.surface),
      findExamples(tagged.lemma, tagged.surface, sentence, episodeId, signature),
    ])

    let sensePos: string | null = null
    if (best) {
      sensePos = best.pos
    }

    console.log(`[translate] "${word}" -> ${tagged.lemma} in ${Date.now() - startedAt}ms`)

    res.json({
      word,
      lemma: tagged.lemma,
      translation: translation ?? "",
      partOfSpeech: partOfSpeechLabel(tagged.pos, sensePos),
      definition: best?.definition ?? "",
      otherMeanings: pickOtherMeanings(ranked),
      rarity,
      examples,
      /// Kept for the current popup until it switches to the fields above
      usageNote: rarity.label,
      exampleSentence: examples[0]?.text ?? "",
    })
  } catch (err) {
    console.error("[translate] failed", err)
    res.status(500).json({ error: "Translation failed" })
  }
})

export default router