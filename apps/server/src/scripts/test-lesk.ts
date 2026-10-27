import 'dotenv/config'
import { pool } from '../db/index.js'
import { tagWordInContext } from '../nlp/tagger.js'
import { disambiguate } from '../nlp/lesk.js'

const cases = [
  { word: 'bank', sentence: 'I went to the bank to deposit my paycheck.' },
  { word: 'bank', sentence: 'We sat on the bank of the river and watched the water.' },
  { word: 'run', sentence: 'I went for a morning run before work.' },
  { word: 'disciples', sentence: 'In order to make disciples who make disciples.' },
  { word: 'culture', sentence: 'You want your group members to get the culture of the group.' },
]

async function main(): Promise<void> {
  for (const c of cases) {
    const tagged = tagWordInContext(c.word, c.sentence)
    const ranked = await disambiguate(tagged.lemma, tagged.wordnetPos, tagged.contextLemmas, tagged.surface)

    console.log(`\n"${c.sentence}"`)
    console.log(`  ${tagged.lemma} (${tagged.pos}), ${ranked.length} senses in WordNet`)

    const top = ranked.slice(0, 2)
    for (let i = 0; i < top.length; i++) {
      const s = top[i]
      if (!s) {
        continue
      }
      const label = i === 0 ? 'PICK' : 'next'
      const matched = s.overlap.length > 0 ? `  matched: ${s.overlap.join(', ')}` : ''
      console.log(`  ${label} [${s.pos}${s.sense_rank}] score ${s.score.toFixed(2)}: ${s.definition}${matched}`)
    }
  }
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})