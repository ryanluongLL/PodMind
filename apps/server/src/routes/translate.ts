import {Router} from "express";
import * as deepl from "deepl-node";
import {pool} from "../db/index.js";
import {tagWordInContext, lemmatizeText} from "../nlp/tagger.js"
import {disambiguate} from "../nlp/lesk.js"
import {findExamples} from "../nlp/examples.js"

const router = Router()
const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

///Part of the speech for WordNet senses (used when Lesk picked a meaning)
const SENSE_POS_LABELS: Record<string,string>={
    n: "noun",
    v: "verb",
    a: "adjective",
    r: "adverb",
}

///Part of the speech labels for wink-nlp tags (used for words WordNet doesn't
/// cover, like "the" or "because")
const TAG_POS_LABELS: Record<string,string>={
    NOUN: "noun",
    PROPN: "proper noun",
    VERB: "verb",
    AUX: "verb",
    ADJ: "adjective",
    ADV: "adverb",
    PRON:"pronoun",
    ADP:"preposition",
    CCONJ:"conjunction",
    SCONJ:"conjunction",
    DET:"determiner",
    NUM: "number",
    INTJ: "interjection",
    PART: "particle",
}

interface Rarity{
    rank: number | null
    band: "very common" | "common" | "less common" | "rare"
    label: string
}

interface OtherMeaning{
    partOfSpeech: string
    definition: string
}

///Deepl needs a regional variant for a few target languages
function toDeepLTarget(code: string): deepl.TargetLanguageCode{
    if(code === "pt") return "pt-BR"
    if(code === "en") return "en-US"
    return code as deepl.TargetLanguageCode   
}

///Rarity comes from the subtitle frequency list. Bands are based on common
///vocabulary reseach: knowing the top 3000 words covers most everyday speech
async function getRarity(lemma:string, surface: string): Promise<Rarity>{
    const {rows} = await pool.query<{rank: number}>(
        `SELECT rank FROM word_frequency WHERE word = ANY($1) ORDER BY rank LIMIT 1`,
        [[lemma, surface.toLowerCase()]]
    )
    const rank = rows[0]?.rank ?? null

     if (rank !== null && rank <= 1000) {
        return { rank, band: 'very common', label: 'One of the 1,000 most used words in spoken English.' }
    }
    if (rank !== null && rank <= 3000) {
        return { rank, band: 'common', label: 'One of the 3,000 most used words. Worth learning early.' }
    }
    if (rank !== null && rank <= 10000) {
        return { rank, band: 'less common', label: 'Less common. Useful once you know the basics.' }
    }
    return { rank, band: 'rare', label: 'Rare in everyday speech. Often specialized or formal.' }
}

///Checks the Postgres cache before calling DeepL. The cache key includes the
/// WordNet sense Lesk chose, so different meanings of the same word are cached
/// separately. Returns null if DeepL fails, so the rest of the popup still works.
async function getTranslation(
    surface:string,
    sentence: string,
    targetLang: string,
    cacheKey: string
): Promise<string | null>{
    const cached = await pool.query<{translation: string}>(
        `SELECT translation FROM translation_cache WHERE word = $1 AND target_lang = $2`,
        [cacheKey, targetLang]
    )
    const hit = cached.rows[0]
    if(hit) return hit.translation

    try{
        const result = await translator.translateText(surface, "en", toDeepLTarget(targetLang),{
            context: sentence,
        })
        const translation = Array.isArray(result) ? result[0]?.text ?? "" : result.text
        
        await pool.query(
            `INSERT INTO translation_cache (word, target_lang, translation)
            VALUES ($1, $2, $3)
            ON CONFLICT (word, target_lang) DO NOTHING`,
            [cacheKey, targetLang, translation],
        )

        return translation
    }catch(err){
        console.error("[translate] DeepL failed", err)
        return null
    }
}

/// POST /translate
/// Builds the word popup entirely from self owned data: context tagging,
/// weighted Lesk over WordNet, transcript examples, and the frequency list.
/// DeepL is the only external call, and it is cached.
router.post("/", async (req, res) => {
    const {word, targetLang, context, episodeId} = req.body as {
        word?: string
        targetLang?: string
        context?: string
        episodeId?: string
    }

    if(!word || !targetLang){
        res.status(400).json({error: "word and targetLang are required"})
        return
    }

    const sentence = context && context.trim().length > 0 ? context: word
    const startedAt = Date.now()

    try{
        const tagged = tagWordInContext(word, sentence)
        const ranked = await disambiguate(tagged.lemma, tagged.wordnetPos, tagged.contextLemmas, tagged.surface)
        const best = ranked[0] ?? null

        let signature = new Set<string>()
        if(best)
            signature = new Set(lemmatizeText(`${best.definition} ${best.examples.join(" ")}`))

        let senseKey = "none"
        if(best)
            senseKey = String(best.id)
        const cacheKey = `${tagged.surface.toLowerCase()}#${senseKey}`

        const [translation, rarity, examples] = await Promise.all([
            getTranslation(tagged.surface, sentence, targetLang, cacheKey),
            getRarity(tagged.lemma, tagged.surface),
            findExamples(tagged.lemma, tagged.surface, sentence, episodeId ?? null, signature ),
        ])

        ///Up to two runner up meanings, skippng duplicate definitions.
        const otherMeanings: OtherMeaning[] = []
        for(let i = 1; i < ranked.length && otherMeanings.length < 2; i++){
            const sense = ranked[i]
            if(!sense || (best && sense.definition === best.definition)){
                continue
            }
            otherMeanings.push({
                partOfSpeech: SENSE_POS_LABELS[sense.pos] ?? "",
                definition: sense.definition,
            })
        }

        let partOfSpeech = TAG_POS_LABELS[tagged.pos] ?? ""
        if(best){
            partOfSpeech = SENSE_POS_LABELS[best.pos] ?? partOfSpeech
        }

        console.log(`[translate] "${word}" -> ${tagged.lemma} in ${Date.now() - startedAt}ms`)

        res.json({
            word,
            lemma: tagged.lemma,
            translation: translation ?? "",
            partOfSpeech,
            definition: best?.definition ?? "",
            otherMeanings,
            rarity,
            examples,
            ///Kept for the current popup until step 6 switches to the fields above
            usageNote: rarity.label,
            exampleSentence: examples[0]?.text ?? "",
        })
    }catch(err){
        console.error("[translate] failed", err)
        res.status(500).json({error: "Translation failed"})
    }
})

export default router