import 'dotenv/config'
import { pool } from '../db/index.js'
import { tagWordInContext, lemmatizeText } from '../nlp/tagger.js'
import { disambiguate } from '../nlp/lesk.js'
import { findExamples } from '../nlp/examples.js'

async function main(): Promise<void> {
  const word = process.argv[2] ?? 'group'
  const sentence = process.argv[3] ?? `I want to talk about the ${word} today.`

  const tagged = tagWordInContext(word, sentence)
  const ranked = await disambiguate(tagged.lemma, tagged.wordnetPos, tagged.contextLemmas, tagged.surface)
  const best = ranked[0]

  let signature = new Set<string>()
  if (best) {
    signature = new Set(lemmatizeText(`${best.definition} ${best.examples.join(' ')}`))
    console.log(`\n${tagged.lemma} (${tagged.pos}): ${best.definition}`)
  } else {
    console.log(`\n${tagged.lemma}: no WordNet entry`)
  }

  const examples = await findExamples(tagged.lemma, tagged.surface, sentence, null, signature)

  if (examples.length === 0) {
    console.log('  no example sentences found in transcripts')
  }
  for (const ex of examples) {
    console.log(`\n  "${ex.text}"`)
    console.log(`    from ${ex.podcastName}: ${ex.episodeTitle} at ${Math.floor(ex.start)}s`)
  }

  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})