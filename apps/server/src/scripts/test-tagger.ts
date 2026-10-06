import { tagWordInContext } from '../nlp/tagger.js'

const cases = [
  { word: 'run', sentence: 'I went for a morning run before work.' },
  { word: 'run', sentence: 'I run every morning before work.' },
  { word: 'disciples', sentence: 'In order to make disciples who make disciples.' },
  { word: 'bank', sentence: 'I went to the bank to deposit my paycheck.' },
  { word: 'bank', sentence: 'We sat on the bank of the river and watched the water.' },
]

for (const c of cases) {
  const result = tagWordInContext(c.word, c.sentence)
  console.log(`\n"${c.sentence}"`)
  console.log(`  word: ${c.word}  lemma: ${result.lemma}  pos: ${result.pos} (${result.wordnetPos})`)
  console.log(`  context: ${result.contextLemmas.join(', ')}`)
}