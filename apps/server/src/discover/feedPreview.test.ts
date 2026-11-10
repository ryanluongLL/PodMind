import { describe, it, expect } from "vitest"
import {
  isAllowedFeedUrl,
  parseDurationSeconds,
  median,
  cleanDescription,
  cadenceWord,
  cadenceLabel,
  timeAgo,
  scoreFit,
  DESCRIPTION_MAX_CHARS,
  type FitInput,
} from "./feedPreview.js"

describe("isAllowedFeedUrl", () => {
  it("allows public http and https feeds", () => {
    expect(isAllowedFeedUrl("https://feeds.example.com/podcast.rss")).toBe(true)
    expect(isAllowedFeedUrl("http://anchor.fm/s/abc/podcast/rss")).toBe(true)
    expect(isAllowedFeedUrl("https://172.32.0.1/feed")).toBe(true)
  })

  it("rejects anything that is not a valid http(s) URL", () => {
    expect(isAllowedFeedUrl("not a url")).toBe(false)
    expect(isAllowedFeedUrl("")).toBe(false)
    expect(isAllowedFeedUrl("ftp://example.com/feed")).toBe(false)
    expect(isAllowedFeedUrl("file:///etc/passwd")).toBe(false)
  })

  it("rejects the server's own machine and private networks", () => {
    const blocked = [
      "http://localhost:3001/health",
      "http://127.0.0.1/feed",
      "http://10.0.0.5/feed",
      "http://192.168.1.10/feed",
      "http://172.16.0.1/feed",
      "http://172.31.255.255/feed",
      "http://169.254.169.254/latest/meta-data",
      "http://0.0.0.0/feed",
      "http://[::1]/feed",
      "http://printer.local/feed",
      "http://redis.railway.internal/feed",
    ]
    for (const url of blocked) {
      expect(isAllowedFeedUrl(url), url).toBe(false)
    }
  })
})

describe("parseDurationSeconds", () => {
  it("reads plain seconds as a string or number", () => {
    expect(parseDurationSeconds("754")).toBe(754)
    expect(parseDurationSeconds(754)).toBe(754)
    expect(parseDurationSeconds("12.6")).toBe(13)
  })

  it("reads MM:SS and HH:MM:SS", () => {
    expect(parseDurationSeconds("12:34")).toBe(754)
    expect(parseDurationSeconds("1:02:03")).toBe(3723)
  })

  it("returns null for missing or invalid values", () => {
    expect(parseDurationSeconds(undefined)).toBeNull()
    expect(parseDurationSeconds(null)).toBeNull()
    expect(parseDurationSeconds("")).toBeNull()
    expect(parseDurationSeconds("abc")).toBeNull()
    expect(parseDurationSeconds("1:xx")).toBeNull()
    expect(parseDurationSeconds("1:2:3:4")).toBeNull()
  })
})

describe("median", () => {
  it("returns null for no values", () => {
    expect(median([])).toBeNull()
  })

  it("returns the middle value for odd counts and the mean of the middle two for even counts", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it("ignores one huge outlier, unlike an average", () => {
    expect(median([6, 7, 6, 8, 95])).toBe(7)
  })

  it("does not change the input array", () => {
    const values = [3, 1, 2]
    median(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe("cleanDescription", () => {
  it("strips HTML tags and collapses whitespace", () => {
    expect(cleanDescription("<p>Hello <b>world</b></p>\n\n<br/>Bye")).toBe("Hello world Bye")
  })

  it("decodes common entities", () => {
    expect(cleanDescription("Tom &amp; Jerry &quot;live&quot; &lt;3 it&#39;s")).toBe(
      "Tom & Jerry \"live\" <3 it's"
    )
  })

  it("decodes &amp; last, so an escaped entity stays escaped once", () => {
    expect(cleanDescription("Use &amp;lt;b&amp;gt; for bold")).toBe("Use &lt;b&gt; for bold")
  })

  it("keeps whole sentences when the text is too long", () => {
    const first = "This is the first sentence about learning English."
    const second = "This second sentence is also quite reasonable to keep around."
    const filler = " More words here.".repeat(20)
    const result = cleanDescription(`${first} ${second}${filler}`)
    expect(result.startsWith(`${first} ${second}`)).toBe(true)
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS)
    expect(result.endsWith(".")).toBe(true)
  })

  it("cuts at the last full word when there is no sentence break early enough", () => {
    const longRunOn = "word ".repeat(100).trim()
    const result = cleanDescription(longRunOn)
    expect(result.endsWith("word...")).toBe(true)
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS + 3)
  })
})

describe("cadence and timeAgo", () => {
  it("describes the release schedule from the typical gap between episodes", () => {
    expect(cadenceWord(1)).toBe("daily")
    expect(cadenceWord(3)).toBe("several times a week")
    expect(cadenceWord(7)).toBe("weekly")
    expect(cadenceWord(14)).toBe("every two weeks")
    expect(cadenceWord(30)).toBe("about monthly")
    expect(cadenceWord(60)).toBeNull()
  })

  it("turns the schedule into a label", () => {
    expect(cadenceLabel(7)).toBe("New episodes weekly")
    expect(cadenceLabel(60)).toBe("Irregular schedule")
  })

  it("phrases how long ago the last episode was", () => {
    expect(timeAgo(45)).toBe("45 days ago")
    expect(timeAgo(150)).toBe("5 months ago")
    expect(timeAgo(365)).toBe("1 year ago")
    expect(timeAgo(800)).toBe("2 years ago")
  })
})

describe("scoreFit", () => {
  const base: FitInput = {
    genre: "History",
    medianMinutes: null,
    gapDays: null,
    daysSinceLast: null,
    isEnglish: true,
  }

  it("flags shows that are not in English, regardless of anything else", () => {
    const fit = scoreFit({ ...base, genre: "Language Learning", medianMinutes: 5, isEnglish: false })
    expect(fit.level).toBe("hard")
    expect(fit.label).toBe("Not in English")
  })

  it("rates a short, regular show made for learners as great", () => {
    const fit = scoreFit({ ...base, genre: "Language Learning", medianMinutes: 8, gapDays: 7, daysSinceLast: 3 })
    expect(fit.level).toBe("great")
    expect(fit.reasons).toEqual([
      "Made for language learners",
      "Short episodes, about 8 min",
      "New episodes weekly",
    ])
  })

  it("rates a long weekly show as good", () => {
    const fit = scoreFit({ ...base, medianMinutes: 50, gapDays: 7, daysSinceLast: 2 })
    expect(fit.level).toBe("good")
    expect(fit.reasons).toContain("Long episodes, about 50 min")
  })

  it("rates a long show with no regular schedule as harder", () => {
    const fit = scoreFit({ ...base, medianMinutes: 70, gapDays: 40, daysSinceLast: 10 })
    expect(fit.level).toBe("hard")
  })

  it("reports a stale show's past schedule instead of claiming it is current", () => {
    const fit = scoreFit({
      ...base,
      genre: "Language Learning",
      medianMinutes: 6,
      gapDays: 7,
      daysSinceLast: 150,
    })
    expect(fit.reasons).toContain("Was weekly, last episode 5 months ago")
    expect(fit.reasons).not.toContain("New episodes weekly")
    expect(fit.level).toBe("great")
  })

  it("gives no schedule bonus to a stale show", () => {
    const active = scoreFit({ ...base, medianMinutes: 20, gapDays: 7, daysSinceLast: 5 })
    const stale = scoreFit({ ...base, medianMinutes: 20, gapDays: 7, daysSinceLast: 200 })
    expect(active.level).toBe("good")
    expect(stale.level).toBe("hard")
  })

  it("handles a stale show with no regular schedule", () => {
    const fit = scoreFit({ ...base, gapDays: 90, daysSinceLast: 400 })
    expect(fit.reasons).toContain("Last episode 1 year ago")
  })

  it("does not penalize unknown language, length, or schedule", () => {
    const fit = scoreFit({ ...base, isEnglish: null })
    expect(fit.level).toBe("hard")
    expect(fit.reasons).toEqual([])
  })
})