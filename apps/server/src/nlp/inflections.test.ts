import { describe, it, expect } from "vitest"
import { inflections, inflectionPattern } from "./inflections.js"

describe("inflections", () => {
  it("adds regular plural, past, and ing forms", () => {
    const forms = inflections("group", "group")
    expect(forms).toEqual(expect.arrayContaining(["group", "groups", "grouped", "grouping"]))
  })

  it("drops a final e before ing", () => {
    const forms = inflections("disciple", "disciples")
    expect(forms).toEqual(expect.arrayContaining(["disciple", "disciples", "discipled", "discipling"]))
  })

  it("changes a consonant y to ies and ied", () => {
    const forms = inflections("carry", "carry")
    expect(forms).toEqual(expect.arrayContaining(["carries", "carried"]))
  })

  it("keeps a vowel y as is", () => {
    const forms = inflections("play", "playing")
    expect(forms).toContain("plays")
    expect(forms).not.toContain("plaies")
  })

  it("always includes the clicked surface form, lowercased", () => {
    expect(inflections("go", "Went")).toContain("went")
  })

  it("never returns duplicates", () => {
    const forms = inflections("leader", "leaders")
    expect(new Set(forms).size).toBe(forms.length)
  })

  it("only returns plain words that are safe inside a regular expression", () => {
    const forms = inflections("c++", "(test)")
    for (const form of forms) {
      expect(form).toMatch(/^[a-z'-]+$/)
    }
  })
})

describe("inflectionPattern", () => {
  it("builds a whole word Postgres pattern of every form", () => {
    expect(inflectionPattern("run", "run")).toBe("\\m(run|runs|runes|runed|rund|runing)\\M")
  })

  it("returns null when there is nothing safe to search for", () => {
    expect(inflectionPattern("123", "456")).toBeNull()
  })
})