import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

// Loading the model is the slow part (a few hundred ms), so it happens once
// when the server starts, not on every request.
const nlp = winkNLP(model)
const its = nlp.its

// wink-nlp's type definitions describe its.lemma with an extra "addons"
// parameter that the model fills in at runtime, which makes TypeScript reject
// it in .out(). At runtime it behaves exactly like its.value (one string per
// token), so we give it that type.
const lemmaHelper = its.lemma as unknown as typeof its.value

export type WordNetPos = 'n' | 'v' | 'a' | 'r'

export interface TaggedWord {
  surface: string
  lemma: string
  pos: string
  wordnetPos: WordNetPos | null
  contextLemmas: string[]
}

// wink-nlp uses Universal POS tags. WordNet only has four categories.
function toWordNetPos(pos: string): WordNetPos | null {
  if (pos === 'NOUN' || pos === 'PROPN') {
    return 'n'
  }
  if (pos === 'VERB' || pos === 'AUX') {
    return 'v'
  }
  if (pos === 'ADJ') {
    return 'a'
  }
  if (pos === 'ADV') {
    return 'r'
  }
  return null
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z'-]/g, '')
}

// Tags the whole sentence, then finds the clicked word inside it. Tagging the
// word in context is what lets "run" in "a morning run" come back as a noun
// and "run" in "I run every day" come back as a verb.
export function tagWordInContext(word: string, sentence: string): TaggedWord {
  const target = normalize(word)

  const doc = nlp.readDoc(sentence)
  const tokens = doc.tokens()
  const values = tokens.out() as string[]
  const posTags = tokens.out(its.pos) as string[]
  const lemmas = tokens.out(lemmaHelper) as string[]
  const types = tokens.out(its.type) as string[]
  const stopFlags = tokens.out(its.stopWordFlag) as boolean[]

  let index = -1
  for (let i = 0; i < values.length; i++) {
    if (normalize(values[i] ?? '') === target) {
      index = i
      break
    }
  }

  // Context = every meaningful word in the sentence except the clicked one.
  // Stop words like "the" and "is" are skipped since they carry no meaning
  // that helps tell senses apart.
  const contextLemmas: string[] = []
  for (let i = 0; i < values.length; i++) {
    if (i === index) {
      continue
    }
    if (types[i] !== 'word') {
      continue
    }
    if (stopFlags[i]) {
      continue
    }
    contextLemmas.push((lemmas[i] ?? '').toLowerCase())
  }

  // The word wasn't found as its own token, which happens with contractions
  // like "don't" (split into "do" and "n't"). Fall back to the raw word.
  if (index === -1) {
    return {
      surface: word,
      lemma: target,
      pos: 'X',
      wordnetPos: null,
      contextLemmas,
    }
  }

  const pos = posTags[index] ?? 'X'

  return {
    surface: values[index] ?? word,
    lemma: (lemmas[index] ?? target).toLowerCase(),
    pos,
    wordnetPos: toWordNetPos(pos),
    contextLemmas,
  }
}

// Returns the lemmas of all meaningful words in a piece of text. Used to turn
// dictionary definitions into the same form as the sentence context, so that
// "deposits" in a definition matches "deposit" in the sentence.
export function lemmatizeText(text: string): string[] {
  const doc = nlp.readDoc(text)
  const tokens = doc.tokens()
  const lemmas = tokens.out(lemmaHelper) as string[]
  const types = tokens.out(its.type) as string[]
  const stopFlags = tokens.out(its.stopWordFlag) as boolean[]

  const result: string[] = []
  for (let i = 0; i < lemmas.length; i++) {
    if (types[i] !== 'word') {
      continue
    }
    if (stopFlags[i]) {
      continue
    }
    result.push((lemmas[i] ?? '').toLowerCase())
  }
  return result
}