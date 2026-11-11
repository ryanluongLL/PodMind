import { describe, it, expect } from "vitest"
import { parseRange } from "./range.js"

describe("parseRange", () => {
  const size = 1000

  it("sends the whole file when there is no range", () => {
    expect(parseRange(undefined, size)).toEqual({ kind: "full" })
    expect(parseRange("", size)).toEqual({ kind: "full" })
  })

  it("reads a start and end", () => {
    expect(parseRange("bytes=0-99", size)).toEqual({ kind: "partial", start: 0, end: 99 })
    expect(parseRange("bytes=500-999", size)).toEqual({ kind: "partial", start: 500, end: 999 })
  })

  it("reads an open ended range to the end of the file", () => {
    expect(parseRange("bytes=900-", size)).toEqual({ kind: "partial", start: 900, end: 999 })
  })

  it("reads a suffix range as the last N bytes", () => {
    expect(parseRange("bytes=-100", size)).toEqual({ kind: "partial", start: 900, end: 999 })
    expect(parseRange("bytes=-5000", size)).toEqual({ kind: "partial", start: 0, end: 999 })
  })

  it("cuts an end that runs past the file", () => {
    expect(parseRange("bytes=990-5000", size)).toEqual({ kind: "partial", start: 990, end: 999 })
  })

  it("refuses a range that starts at or past the end", () => {
    expect(parseRange("bytes=1000-", size)).toEqual({ kind: "unsatisfiable" })
    expect(parseRange("bytes=5000-6000", size)).toEqual({ kind: "unsatisfiable" })
    expect(parseRange("bytes=-0", size)).toEqual({ kind: "unsatisfiable" })
    expect(parseRange("bytes=0-", 0)).toEqual({ kind: "unsatisfiable" })
    expect(parseRange("bytes=-10", 0)).toEqual({ kind: "unsatisfiable" })
  })

  it("ignores headers it cannot read and sends the whole file", () => {
    expect(parseRange("bytes=abc-def", size)).toEqual({ kind: "full" })
    expect(parseRange("bytes=-", size)).toEqual({ kind: "full" })
    expect(parseRange("bytes=200-100", size)).toEqual({ kind: "full" })
    expect(parseRange("bytes=0-1,5-6", size)).toEqual({ kind: "full" })
    expect(parseRange("items=0-10", size)).toEqual({ kind: "full" })
  })
})