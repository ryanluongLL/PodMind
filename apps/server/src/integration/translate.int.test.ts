import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { pool } from "../db/index.js"
import { translateWord } from "../services/translator.js"
import { insertPodcast, insertEpisode, insertTranscript, insertSense, insertFrequencies } from "./factories.js"

const RIVER_SENSE = "sloping land (especially the slope beside a body of water)"
const MONEY_SENSE = "a financial institution that accepts deposits and channels the money into lending activities"

let riverId = 0
let moneyId = 0

/// A three meaning "bank" plus frequency ranks for the words around it
beforeEach(async () => {
  riverId = await insertSense("bank", "n", 1, RIVER_SENSE, ["they pulled the canoe up on the bank"])
  moneyId = await insertSense("bank", "n", 2, MONEY_SENSE, ["he cashed a check at the bank"])
  await insertSense("bank", "v", 1, "tip laterally", ["the pilot had to bank the aircraft"])
  await insertFrequencies({ bank: 1500, money: 300, deposit: 5000, river: 2500, water: 600 })
  vi.mocked(translateWord).mockResolvedValue("ngân hàng")
})

function lookup(body: Record<string, unknown>) {
  return request(app).post("/translate").send(body)
}

describe("POST /translate", () => {
  it("picks the money meaning when the sentence is about money", async () => {
    const res = await lookup({ word: "bank", targetLang: "vi", context: "I need to deposit money at the bank." })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      word: "bank",
      lemma: "bank",
      translation: "ngân hàng",
      partOfSpeech: "noun",
      definition: MONEY_SENSE,
      rarity: { rank: 1500, band: "common" },
    })
    expect(res.body.otherMeanings).toEqual([
      { partOfSpeech: "noun", definition: RIVER_SENSE },
      { partOfSpeech: "verb", definition: "tip laterally" },
    ])
    expect(translateWord).toHaveBeenCalledWith("bank", "I need to deposit money at the bank.", "vi")
  })

  it("picks the river meaning when the sentence is about a river", async () => {
    const res = await lookup({
      word: "bank",
      targetLang: "vi",
      context: "We sat on the bank of the river and watched the water.",
    })
    expect(res.body.definition).toBe(RIVER_SENSE)
  })

  it("caches each meaning separately and reuses the cache", async () => {
    await lookup({ word: "bank", targetLang: "vi", context: "I need to deposit money at the bank." })
    await lookup({ word: "bank", targetLang: "vi", context: "Put the money in the bank before you deposit more." })
    expect(translateWord).toHaveBeenCalledTimes(1)

    vi.mocked(translateWord).mockResolvedValueOnce("bờ sông")
    const river = await lookup({ word: "bank", targetLang: "vi", context: "We sat on the bank of the river." })
    expect(river.body.translation).toBe("bờ sông")
    expect(translateWord).toHaveBeenCalledTimes(2)

    const { rows } = await pool.query(`SELECT word, translation FROM translation_cache ORDER BY word`)
    expect(rows).toEqual([
      { word: `bank#${moneyId}`, translation: "ngân hàng" },
      { word: `bank#${riverId}`, translation: "bờ sông" },
    ].sort((a, b) => a.word.localeCompare(b.word)))
  })

  it("keeps separate cache entries per language", async () => {
    await lookup({ word: "bank", targetLang: "vi", context: "I deposit money at the bank." })
    vi.mocked(translateWord).mockResolvedValueOnce("banco")
    const res = await lookup({ word: "bank", targetLang: "es", context: "I deposit money at the bank." })
    expect(res.body.translation).toBe("banco")
    expect(translateWord).toHaveBeenCalledTimes(2)
  })

  it("still answers when DeepL fails, and does not cache the failure", async () => {
    vi.mocked(translateWord).mockRejectedValueOnce(new Error("quota exceeded"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const failed = await lookup({ word: "bank", targetLang: "vi", context: "I deposit money at the bank." })
    expect(failed.status).toBe(200)
    expect(failed.body.translation).toBe("")
    expect(failed.body.definition).toBe(MONEY_SENSE)

    const retried = await lookup({ word: "bank", targetLang: "vi", context: "I deposit money at the bank." })
    expect(retried.body.translation).toBe("ngân hàng")
    expect(translateWord).toHaveBeenCalledTimes(2)
  })

  it("handles words WordNet does not have", async () => {
    vi.mocked(translateWord).mockResolvedValueOnce("cái")
    const res = await lookup({ word: "the", targetLang: "vi", context: "The cat sat on the mat." })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      lemma: "the",
      translation: "cái",
      partOfSpeech: "determiner",
      definition: "",
      otherMeanings: [],
      rarity: { band: "rare" },
    })
  })

  it("adds example sentences from transcripts, skipping the one being read", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    const current = "I need to deposit money at the bank."
    await insertTranscript(episodeId, {
      status: "done",
      fullText: "",
      segments: [
        { start: 1, end: 3, text: current },
        { start: 4, end: 7, text: "The bank gave her a loan so she could buy the house." },
        { start: 8, end: 9, text: "Nothing related here at all." },
      ],
    })

    const res = await lookup({ word: "bank", targetLang: "vi", context: current, episodeId })

    expect(res.body.examples.map((e: { text: string }) => e.text)).toEqual([
      "The bank gave her a loan so she could buy the house.",
    ])
    expect(res.body.examples[0]).toMatchObject({ episodeId, start: 4 })
    expect(res.body.exampleSentence).toBe("The bank gave her a loan so she could buy the house.")
  })

  it("finds examples that use another form of the word", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    await insertTranscript(episodeId, {
      status: "done",
      segments: [{ start: 0, end: 4, text: "Most banks close early on Fridays in this town." }],
    })
    const res = await lookup({ word: "bank", targetLang: "vi", context: "I deposit money at the bank." })
    expect(res.body.examples[0]?.text).toBe("Most banks close early on Fridays in this town.")
  })

  it("ignores transcripts that are not finished", async () => {
    const episodeId = await insertEpisode(await insertPodcast())
    await insertTranscript(episodeId, {
      status: "processing",
      segments: [{ start: 0, end: 4, text: "The bank opens at nine every single morning." }],
    })
    const res = await lookup({ word: "bank", targetLang: "vi", context: "I deposit money at the bank." })
    expect(res.body.examples).toEqual([])
  })

  it("rejects bad requests before calling DeepL", async () => {
    expect((await lookup({ targetLang: "vi" })).status).toBe(400)
    expect((await lookup({ word: "bank" })).status).toBe(400)
    expect((await lookup({ word: "bank", targetLang: "fr" })).status).toBe(400)
    expect((await lookup({ word: "x".repeat(41), targetLang: "vi" })).status).toBe(400)
    expect(translateWord).not.toHaveBeenCalled()
  })

  it("answers 500 when the database fails", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("connection lost"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await lookup({ word: "bank", targetLang: "vi", context: "At the bank." })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Translation failed" })
  })
})