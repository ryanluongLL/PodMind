import { describe, it, expect } from "vitest"
import { toDeepLTarget } from "./translator.js"

describe("toDeepLTarget", () => {
  it("adds the regional variant DeepL requires", () => {
    expect(toDeepLTarget("pt")).toBe("pt-BR")
    expect(toDeepLTarget("en")).toBe("en-US")
  })

  it("passes other languages through", () => {
    expect(toDeepLTarget("vi")).toBe("vi")
    expect(toDeepLTarget("ja")).toBe("ja")
  })
})