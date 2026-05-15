import { Router } from "express";
import * as deepl from 'deepl-node'
import Anthropic from "@anthropic-ai/sdk";

const router = Router()
const translator = new deepl.Translator(process.env.DEEPL_API_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /translate
// Takes a word/phrase, the user's native language, and the surrounding sentence.
// Returns the translation + Claude-generated breakdown (part of speech, usage notes).
// We call both in parallel to minimize latency.
router.post('/', async (req, res) => {
    const { word, targetLang, context } = req.body as {
        word: string
        targetLang: string
        context: string
    }

    if (!word || !targetLang) {
        res.status(400).json({ error: 'word and targetLang are required' })
        return
    }

    try {
        const [translationResult, claudeResult] = await Promise.all([
        // DeepL for accurate translation
        translator.translateText(word, 'en', targetLang as deepl.TargetLanguageCode),

        // Claude for contextual explanation — part of speech, usage, idioms
        anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 300,
            messages: [{
            role: 'user',
            content: `A language learner is reading this sentence from a podcast transcript:
    "${context}"

    They clicked on the word/phrase: "${word}"

    Give them a brief learning breakdown. Respond ONLY with JSON in this exact shape:
    {
    "partOfSpeech": "noun/verb/adjective/idiom/etc",
    "definition": "simple English definition in 1 sentence",
    "usageNote": "1 sentence about when/how native speakers use this",
    "exampleSentence": "a natural example sentence using this word"
    }

    Keep everything simple — this learner is at intermediate English level.`
            }]
        })
    ])

        const translation = Array.isArray(translationResult)
        ? translationResult[0]?.text
        : translationResult.text

        const claudeText = claudeResult.content[0]?.type === 'text'
        ? claudeResult.content[0].text
        : '{}'

        let breakdown = { partOfSpeech: '', definition: '', usageNote: '', exampleSentence: '' }
        try {
        breakdown = JSON.parse(claudeText.replace(/```json|```/g, '').trim())
        } catch {
        // Claude didn't return valid JSON — use empty defaults, translation still works
        }

        res.json({
        word,
        translation,
        ...breakdown,
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Translation failed' })
    }
})

export default router
