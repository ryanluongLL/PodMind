import { describe, it, expect } from "vitest"
import {
  checkTranslateRequest,
  rarityForRank,
  partOfSpeechLabel,
  pickOtherMeanings,
  MAX_WORD_LENGTH,
  MAX_CONTEXT_LENGTH,
} from "./wordInfo.js"

describe("checkTranslateRequest", () => {
  it("accepts a normal request and trims it", () => {
    const result = checkTranslateRequest({
      word: "  bank ",
      targetLang: "vi",
      context: "  I went to the bank.  ",
      episodeId: "ep-1",
    })
    expect(result).toEqual({
      ok: true,
      value: { word: "bank", targetLang: "vi", sentence: "I went to the bank.", episodeId: "ep-1" },
    })
  })

  it("uses the word itself as the sentence when there is no context", () => {
    const result = checkTranslateRequest({ word: "bank", targetLang: "es", context: "   " })
    expect(result.ok && result.value.sentence).toBe("bank")
    expect(result.ok && result.value.episodeId).toBeNull()
  })

  it("requires word and targetLang", () => {
    expect(checkTranslateRequest({ targetLang: "vi" }).ok).toBe(false)
    expect(checkTranslateRequest({ word: "bank" }).ok).toBe(false)
    expect(checkTranslateRequest({ word: "   ", targetLang: "vi" }).ok).toBe(false)
    expect(checkTranslateRequest(null).ok).toBe(false)
    expect(checkTranslateRequest({ word: 42, targetLang: "vi" }).ok).toBe(false)
  })

  it("rejects languages the app does not offer", () => {
    const result = checkTranslateRequest({ word: "bank", targetLang: "fr" })
    expect(result).toEqual({ ok: false, error: "targetLang must be one of vi, es, zh, ko, ja, pt" })
  })

  it("rejects a word long enough to waste DeepL credit", () => {
    expect(checkTranslateRequest({ word: "a".repeat(MAX_WORD_LENGTH), targetLang: "vi" }).ok).toBe(true)
    expect(checkTranslateRequest({ word: "a".repeat(MAX_WORD_LENGTH + 1), targetLang: "vi" }).ok).toBe(false)
  })

  it("cuts a very long context instead of rejecting it", () => {
    const result = checkTranslateRequest({ word: "bank", targetLang: "vi", context: "x".repeat(5000) })
    expect(result.ok && result.value.sentence.length).toBe(MAX_CONTEXT_LENGTH)
  })
})

describe("rarityForRank", () => {
  it("puts each rank in the right band, with inclusive upper bounds", () => {
    expect(rarityForRank(1).band).toBe("very common")
    expect(rarityForRank(1000).band).toBe("very common")
    expect(rarityForRank(1001).band).toBe("common")
    expect(rarityForRank(3000).band).toBe("common")
    expect(rarityForRank(3001).band).toBe("less common")
    expect(rarityForRank(10000).band).toBe("less common")
    expect(rarityForRank(10001).band).toBe("rare")
  })

  it("treats words missing from the frequency list as rare", () => {
    expect(rarityForRank(null)).toMatchObject({ rank: null, band: "rare" })
  })
})

describe("partOfSpeechLabel", () => {
  it("prefers the chosen meaning's part of speech", () => {
    expect(partOfSpeechLabel("VERB", "n")).toBe("noun")
    expect(partOfSpeechLabel("ADJ", "s")).toBe("adjective")
  })

  it("falls back to the tagger for words WordNet does not cover", () => {
    expect(partOfSpeechLabel("DET", null)).toBe("determiner")
    expect(partOfSpeechLabel("DET", "x")).toBe("determiner")
    expect(partOfSpeechLabel("SYM", null)).toBe("")
  })
})

describe("pickOtherMeanings", () => {
  it("returns up to two runner ups, skipping repeated definitions", () => {
    const ranked = [
      { pos: "n", definition: "a financial institution" },
      { pos: "n", definition: "a financial institution" },
      { pos: "n", definition: "sloping land beside water" },
      { pos: "n", definition: "sloping land beside water" },
      { pos: "v", definition: "tip laterally" },
      { pos: "v", definition: "do business with a bank" },
    ]
    expect(pickOtherMeanings(ranked)).toEqual([
      { partOfSpeech: "noun", definition: "sloping land beside water" },
      { partOfSpeech: "verb", definition: "tip laterally" },
    ])
  })

  it("returns nothing when there is only one meaning or none", () => {
    expect(pickOtherMeanings([])).toEqual([])
    expect(pickOtherMeanings([{ pos: "n", definition: "only one" }])).toEqual([])
  })
})