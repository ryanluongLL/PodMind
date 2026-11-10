import { describe, it, expect } from "vitest"
import {
  countSyllables,
  splitSentences,
  splitWords,
  levelFromFlesch,
  adjustForSpeed,
  estimateDifficulty,
  wordsPerMinute,
} from "./readability.js"

describe("countSyllables", () => {
  it("counts short words as one syllable", () => {
    expect(countSyllables("the")).toBe(1)
    expect(countSyllables("cat")).toBe(1)
  })

  it("ignores a silent trailing e", () => {
    expect(countSyllables("make")).toBe(1)
    expect(countSyllables("culture")).toBe(2)
  })

  it("counts vowel groups in longer words", () => {
    expect(countSyllables("water")).toBe(2)
    expect(countSyllables("beautiful")).toBe(3)
    expect(countSyllables("organization")).toBe(5)
  })

  it("strips punctuation and capitals before counting", () => {
    expect(countSyllables("Water,")).toBe(2)
    expect(countSyllables("don't")).toBe(1)
  })

  it("returns 0 for text with no letters", () => {
    expect(countSyllables("")).toBe(0)
    expect(countSyllables("123")).toBe(0)
    expect(countSyllables("...")).toBe(0)
  })
})

describe("splitSentences and splitWords", () => {
  it("splits on sentence ending punctuation and drops empty pieces", () => {
    expect(splitSentences("Hi there. How are you?! Fine...")).toEqual(["Hi there", "How are you", "Fine"])
  })

  it("splits on any whitespace", () => {
    expect(splitWords("  one two\nthree\tfour  ")).toEqual(["one", "two", "three", "four"])
  })
})

describe("levelFromFlesch", () => {
  it("maps each score band to its CEFR level, with inclusive lower bounds", () => {
    expect(levelFromFlesch(120)).toBe("A2")
    expect(levelFromFlesch(80)).toBe("A2")
    expect(levelFromFlesch(79.9)).toBe("B1")
    expect(levelFromFlesch(65)).toBe("B1")
    expect(levelFromFlesch(50)).toBe("B2")
    expect(levelFromFlesch(35)).toBe("C1")
    expect(levelFromFlesch(34.9)).toBe("C2")
    expect(levelFromFlesch(-40)).toBe("C2")
  })
})

describe("adjustForSpeed", () => {
  it("leaves the level alone when speed is unknown or normal", () => {
    expect(adjustForSpeed("B1", 0)).toBe("B1")
    expect(adjustForSpeed("B1", 110)).toBe("B1")
    expect(adjustForSpeed("B1", 165)).toBe("B1")
  })

  it("moves one band easier for slow speech and one band harder for fast speech", () => {
    expect(adjustForSpeed("B1", 109)).toBe("A2")
    expect(adjustForSpeed("B1", 166)).toBe("B2")
  })

  it("never goes past the ends of the scale", () => {
    expect(adjustForSpeed("A1", 80)).toBe("A1")
    expect(adjustForSpeed("C2", 220)).toBe("C2")
  })
})

describe("estimateDifficulty", () => {
  const simple = "I am here. You are there. We go now."
  const complex =
    "Institutional interdependencies necessitate comprehensive organizational reconsideration."

  it("computes the averages that feed the Flesch formula", () => {
    const result = estimateDifficulty(simple, 0)
    expect(result.avgSentenceLength).toBe(3)
    expect(result.avgSyllablesPerWord).toBe(1)
    expect(result.fleschScore).toBeCloseTo(206.835 - 1.015 * 3 - 84.6 * 1, 5)
  })

  it("rates short, simple speech as easy", () => {
    expect(estimateDifficulty(simple, 0).level).toBe("A2")
    expect(estimateDifficulty(simple, 95).level).toBe("A1")
  })

  it("rates long, dense speech as hard", () => {
    expect(estimateDifficulty(complex, 0).level).toBe("C2")
    expect(estimateDifficulty(complex, 200).level).toBe("C2")
  })

  it("explains the result in the reason", () => {
    const result = estimateDifficulty(simple, 140)
    expect(result.reason).toContain("140 wpm")
    expect(result.reason).toContain("3.0 words/sentence")
  })

  it("does not crash on an empty transcript", () => {
    const result = estimateDifficulty("", 0)
    expect(result.avgSentenceLength).toBe(0)
    expect(result.avgSyllablesPerWord).toBe(0)
  })
})

describe("wordsPerMinute", () => {
  const twoMinutes = [
    { start: 0, end: 60, text: "first" },
    { start: 60, end: 120, text: "second" },
  ]

  it("divides the word count by the minutes up to the last segment", () => {
    const text = "word ".repeat(240).trim()
    expect(wordsPerMinute(text, twoMinutes)).toBe(120)
  })

  it("does not count extra spaces or line breaks as words", () => {
    const text = "one  two\n\nthree   four"
    expect(wordsPerMinute(text, [{ start: 0, end: 60, text }])).toBe(4)
  })

  it("returns 0 when timing is missing or unusable", () => {
    expect(wordsPerMinute("some words", null)).toBe(0)
    expect(wordsPerMinute("some words", [])).toBe(0)
    expect(wordsPerMinute("some words", [{ start: 0, end: 0, text: "" }])).toBe(0)
  })
})