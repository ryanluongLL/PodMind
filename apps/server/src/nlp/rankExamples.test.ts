import { describe, it, expect } from "vitest"
import { rankExamples, type CandidateRow, type RankOptions } from "./rankExamples.js"

/// Fake lemmatizer: lowercase words without punctuation, enough for tests
function fakeLemmatize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

function row(text: string, episodeId: string = "ep-other"): CandidateRow {
  return {
    text,
    episode_id: episodeId,
    episode_title: `Title ${episodeId}`,
    podcast_name: "Show",
    start: 12.5,
    audio_url: "https://example.com/a.mp3",
    icon_url: null,
  }
}

const base: RankOptions = {
  lemma: "bank",
  currentSentence: "I went to the bank today.",
  currentEpisodeId: "ep-current",
  senseSignature: new Set(["money", "deposit", "account"]),
  limit: 3,
  lemmatize: fakeLemmatize,
}

describe("rankExamples", () => {
  it("puts sentences that match the chosen meaning first", () => {
    const result = rankExamples(
      [
        row("We sat on the river bank and watched the boats go by."),
        row("She opened an account at the bank to deposit her money."),
      ],
      base
    )
    expect(result[0]?.text).toBe("She opened an account at the bank to deposit her money.")
  })

  it("skips the sentence being read and duplicates, ignoring case and spaces", () => {
    const result = rankExamples(
      [
        row("  I went to the bank today.  "),
        row("The bank was closed on Sunday morning again."),
        row("THE BANK WAS CLOSED ON SUNDAY MORNING AGAIN."),
      ],
      base
    )
    expect(result.map((r) => r.text)).toEqual(["The bank was closed on Sunday morning again."])
  })

  it("prefers readable lengths over very short or very long sentences", () => {
    const long = `The bank ${"and then something else happened ".repeat(6)}`.trim()
    const result = rankExamples([row("Bank."), row(long), row("The bank near my house closes at five.")], base)
    expect(result[0]?.text).toBe("The bank near my house closes at five.")
  })

  it("prefers other episodes over the current one", () => {
    const result = rankExamples(
      [row("The bank near my house closes at five.", "ep-current"), row("The bank down the street closes at six.")],
      base
    )
    expect(result[0]?.episodeId).toBe("ep-other")
  })

  it("does not count the word itself toward meaning fit", () => {
    const result = rankExamples(
      [row("Bank bank bank bank bank bank."), row("Put money in the bank every week.")],
      { ...base, senseSignature: new Set(["bank", "money"]) }
    )
    expect(result[0]?.text).toBe("Put money in the bank every week.")
  })

  it("keeps database order for equal scores and respects the limit", () => {
    const rows = [
      row("First bank sentence with enough words here."),
      row("Second bank sentence with enough words here."),
      row("Third bank sentence with enough words here."),
      row("Fourth bank sentence with enough words here."),
    ]
    const result = rankExamples(rows, { ...base, limit: 2 })
    expect(result.map((r) => r.text)).toEqual([
      "First bank sentence with enough words here.",
      "Second bank sentence with enough words here.",
    ])
  })

  it("maps database columns to the API shape", () => {
    const [first] = rankExamples([row("The bank near my house closes at five.")], base)
    expect(first).toEqual({
      text: "The bank near my house closes at five.",
      episodeId: "ep-other",
      episodeTitle: "Title ep-other",
      podcastName: "Show",
      start: 12.5,
      audioUrl: "https://example.com/a.mp3",
      iconUrl: null,
    })
  })

  it("gives no variety bonus when there is no current episode", () => {
    const result = rankExamples(
      [row("Short bank.", "ep-a"), row("The bank near my house closes at five.", "ep-b")],
      { ...base, currentEpisodeId: null }
    )
    expect(result[0]?.episodeId).toBe("ep-b")
  })

  it("returns nothing for no candidates or blank text", () => {
    expect(rankExamples([], base)).toEqual([])
    expect(rankExamples([row("   ")], base)).toEqual([])
  })
})