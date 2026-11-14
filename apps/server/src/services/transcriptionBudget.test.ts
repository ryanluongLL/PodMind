import { describe, it, expect } from "vitest"
import { dailyLimitSeconds, DEFAULT_DAILY_MINUTES, estimateSeconds } from "./transcriptionBudget.js"

describe("dailyLimitSeconds", () => {
  it("uses the default when nothing is set", () => {
    expect(dailyLimitSeconds({})).toBe(DEFAULT_DAILY_MINUTES * 60)
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "  " })).toBe(DEFAULT_DAILY_MINUTES * 60)
  })

  it("reads the limit in minutes", () => {
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "30" })).toBe(1800)
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "1.5" })).toBe(90)
  })

  it("treats 0 as paid transcription turned off", () => {
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "0" })).toBe(0)
  })

  it("falls back to the default for invalid values instead of removing the cap", () => {
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "lots" })).toBe(DEFAULT_DAILY_MINUTES * 60)
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "-5" })).toBe(DEFAULT_DAILY_MINUTES * 60)
    expect(dailyLimitSeconds({ DAILY_PAID_TRANSCRIPTION_MINUTES: "Infinity" })).toBe(DEFAULT_DAILY_MINUTES * 60)
  })
})

describe("estimateSeconds", () => {
  it("turns a 16 kbps file size into seconds", () => {
    /// One minute at 16 kbps is 120,000 bytes
    expect(estimateSeconds(120_000)).toBe(60)
  })

  it("rounds up so a partial second still counts", () => {
    expect(estimateSeconds(1)).toBe(1)
    expect(estimateSeconds(0)).toBe(0)
  })
})