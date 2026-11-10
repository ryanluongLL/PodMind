import { describe, it, expect } from "vitest"
import { isUuid } from "./ids.js"

describe("isUuid", () => {
  it("accepts uuids in either case", () => {
    expect(isUuid("3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d")).toBe(true)
    expect(isUuid("3F2B8C1E-9A4D-4C7B-8E21-5D6F7A8B9C0D")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isUuid("")).toBe(false)
    expect(isUuid("123")).toBe(false)
    expect(isUuid("3f2b8c1e9a4d4c7b8e215d6f7a8b9c0d")).toBe(false)
    expect(isUuid("3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d; DROP TABLE podcasts")).toBe(false)
    expect(isUuid("zzzzzzzz-9a4d-4c7b-8e21-5d6f7a8b9c0d")).toBe(false)
  })
})