import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  dateKey,
  addDays,
  getProfile,
  saveProfile,
  getWords,
  saveWord,
  deleteWord,
  getDueWords,
  previewInterval,
  reviewWord,
  getFavorites,
  toggleFavorite,
  getActivity,
  recordActivity,
  currentStreak,
  useProfile,
  useWords,
  useFavorites,
  useActivity,
  type SavedWord,
} from "./localStore"

const TODAY = "2026-11-09"

function input(word: string) {
  return {
    word,
    translation: `${word} translated`,
    contextSentence: `A sentence with ${word}.`,
    episodeId: "ep-1",
    timestampSeconds: 42,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("dateKey and addDays", () => {
  it("formats the local date with zero padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05")
    expect(dateKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31")
  })

  it("moves across month ends, year ends, and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31")
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01")
    expect(addDays(TODAY, 30)).toBe("2026-12-09")
  })

  it("keeps working across a daylight saving change", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02")
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09")
  })
})

describe("profile", () => {
  it("returns defaults when nothing is saved", () => {
    expect(getProfile()).toEqual({
      nativeLanguage: "vi",
      englishLevel: "B1",
      dailyGoalMinutes: 15,
      onboarded: false,
    })
  })

  it("merges updates into the saved profile", () => {
    saveProfile({ englishLevel: "C2" })
    saveProfile({ onboarded: true })
    expect(getProfile()).toMatchObject({ englishLevel: "C2", onboarded: true, dailyGoalMinutes: 15 })
  })

  it("falls back to defaults when the stored JSON is broken", () => {
    window.localStorage.setItem("podmind:profile", "{not json")
    expect(getProfile().englishLevel).toBe("B1")
  })

  it("fills in fields missing from an older saved profile", () => {
    window.localStorage.setItem("podmind:profile", JSON.stringify({ englishLevel: "A1" }))
    expect(getProfile()).toMatchObject({ englishLevel: "A1", dailyGoalMinutes: 15 })
  })
})

describe("vocabulary", () => {
  it("saves a new word as due today with starting SM-2 values", () => {
    const word = saveWord(input("bank"), TODAY)
    expect(word).toMatchObject({
      word: "bank",
      easeFactor: 2.5,
      intervalDays: 1,
      nextReviewDate: TODAY,
      reviewCount: 0,
    })
    expect(getWords()).toHaveLength(1)
  })

  it("puts newest words first", () => {
    saveWord(input("first"), TODAY)
    saveWord(input("second"), TODAY)
    expect(getWords().map((w) => w.word)).toEqual(["second", "first"])
  })

  it("returns the existing entry when the same word is saved again", () => {
    const first = saveWord(input("bank"), TODAY)
    reviewWord(first.id, 4, TODAY)
    const again = saveWord(input("bank"), "2026-12-01")
    expect(again.id).toBe(first.id)
    expect(again.reviewCount).toBe(1)
    expect(getWords()).toHaveLength(1)
  })

  it("deletes a word by id and ignores unknown ids", () => {
    const a = saveWord(input("a"), TODAY)
    saveWord(input("b"), TODAY)
    deleteWord(a.id)
    deleteWord("missing")
    expect(getWords().map((w) => w.word)).toEqual(["b"])
  })

  it("lists due words, oldest due date first, and leaves out future ones", () => {
    saveWord(input("today"), TODAY)
    saveWord(input("older"), "2026-11-01")
    saveWord(input("future"), "2026-11-20")
    expect(getDueWords(TODAY).map((w) => w.word)).toEqual(["older", "today"])
  })

  it("treats broken vocabulary data as empty", () => {
    window.localStorage.setItem("podmind:vocabulary", "oops")
    expect(getWords()).toEqual([])
  })

  it("still works when storage refuses to save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => saveWord(input("bank"), TODAY)).not.toThrow()
    expect(getWords()).toEqual([])
  })

  it("still reads defaults when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(getWords()).toEqual([])
    expect(getProfile().englishLevel).toBe("B1")
  })
})

describe("SM-2 review", () => {
  it("schedules a new word by rating", () => {
    const cases: [1 | 2 | 3 | 4, number, number][] = [
      [1, 1, 2.18],
      [2, 2, 2.36],
      [3, 3, 2.5],
      [4, 4, 2.6],
    ]
    for (const [rating, interval, ease] of cases) {
      window.localStorage.clear()
      const word = saveWord(input("bank"), TODAY)
      const updated = reviewWord(word.id, rating, TODAY)
      expect(updated?.intervalDays, `rating ${rating}`).toBe(interval)
      expect(updated?.easeFactor, `rating ${rating}`).toBeCloseTo(ease, 5)
      expect(updated?.nextReviewDate).toBe(addDays(TODAY, interval))
      expect(updated?.reviewCount).toBe(1)
    }
  })

  it("previewInterval always matches what reviewWord then does", () => {
    for (const rating of [1, 2, 3, 4] as const) {
      window.localStorage.clear()
      const word = saveWord(input("bank"), TODAY)
      const warmed = reviewWord(word.id, 3, TODAY) as SavedWord
      const predicted = previewInterval(warmed, rating)
      expect(reviewWord(word.id, rating, TODAY)?.intervalDays, `rating ${rating}`).toBe(predicted)
    }
  })

  it("grows the interval with each good review", () => {
    const word = saveWord(input("bank"), TODAY)
    let day = TODAY
    const intervals: number[] = []
    for (let i = 0; i < 4; i++) {
      const updated = reviewWord(word.id, 3, day)
      if (updated) {
        intervals.push(updated.intervalDays)
        day = updated.nextReviewDate
      }
    }
    expect(intervals).toEqual([3, 8, 20, 50])
  })

  it("resets the interval to one day on Again", () => {
    const word = saveWord(input("bank"), TODAY)
    reviewWord(word.id, 4, TODAY)
    const again = reviewWord(word.id, 1, TODAY)
    expect(again?.intervalDays).toBe(1)
  })

  it("never lets ease drop below 1.3", () => {
    const word = saveWord(input("bank"), TODAY)
    let last: SavedWord | null = null
    for (let i = 0; i < 10; i++) {
      last = reviewWord(word.id, 1, TODAY)
    }
    expect(last?.easeFactor).toBe(1.3)
  })

  it("returns null for an unknown word", () => {
    expect(reviewWord("missing", 3, TODAY)).toBeNull()
  })

  it("counts a review as activity for the streak", () => {
    const word = saveWord(input("bank"), TODAY)
    reviewWord(word.id, 3, TODAY)
    expect(getActivity()).toMatchObject({ streak: 1, lastActiveDate: TODAY })
  })
})

describe("ids", () => {
  it("still creates unique ids where crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", {})
    const a = saveWord(input("a"), TODAY)
    const b = saveWord(input("b"), TODAY)
    vi.unstubAllGlobals()
    expect(a.id).not.toBe(b.id)
    expect(a.id.length).toBeGreaterThan(5)
  })
})

describe("favorites", () => {
  it("toggles an episode on and off", () => {
    toggleFavorite("ep-1")
    toggleFavorite("ep-2")
    expect(getFavorites()).toEqual(["ep-1", "ep-2"])
    toggleFavorite("ep-1")
    expect(getFavorites()).toEqual(["ep-2"])
  })
})

describe("activity and streaks", () => {
  it("starts a streak at 1 and adds minutes for the day", () => {
    recordActivity(5, TODAY)
    recordActivity(10, TODAY)
    expect(getActivity()).toEqual({
      streak: 1,
      lastActiveDate: TODAY,
      minutesByDate: { [TODAY]: 15 },
    })
  })

  it("continues the streak on the next day, even across a year end", () => {
    recordActivity(1, "2026-12-30")
    recordActivity(1, "2026-12-31")
    recordActivity(1, "2027-01-01")
    expect(getActivity().streak).toBe(3)
  })

  it("resets the streak after a missed day", () => {
    recordActivity(1, "2026-11-01")
    recordActivity(1, "2026-11-02")
    recordActivity(1, "2026-11-04")
    expect(getActivity().streak).toBe(1)
  })

  it("only keeps the last 30 days of minutes", () => {
    recordActivity(5, "2026-10-01")
    recordActivity(5, "2026-10-10")
    recordActivity(5, TODAY)
    expect(Object.keys(getActivity().minutesByDate).sort()).toEqual(["2026-10-10", TODAY])
  })

  it("shows a streak only if it was continued today or yesterday", () => {
    const activity = { streak: 6, lastActiveDate: "2026-11-08", minutesByDate: {} }
    expect(currentStreak(activity, "2026-11-08")).toBe(6)
    expect(currentStreak(activity, "2026-11-09")).toBe(6)
    expect(currentStreak(activity, "2026-11-10")).toBe(0)
    expect(currentStreak({ streak: 0, lastActiveDate: null, minutesByDate: {} }, TODAY)).toBe(0)
  })
})

describe("React hooks", () => {
  it("re-render when the data changes", () => {
    const { result } = renderHook(() => useWords())
    expect(result.current).toEqual([])
    act(() => {
      saveWord(input("bank"), TODAY)
    })
    expect(result.current?.map((w) => w.word)).toEqual(["bank"])
  })

  it("return the same object until the stored data changes", () => {
    saveProfile({ englishLevel: "C2" })
    const { result, rerender } = renderHook(() => useProfile())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    act(() => {
      saveProfile({ englishLevel: "A1" })
    })
    expect(result.current).not.toBe(first)
    expect(result.current?.englishLevel).toBe("A1")
  })

  it("cover favorites and activity too", () => {
    const favorites = renderHook(() => useFavorites())
    const activity = renderHook(() => useActivity())
    act(() => {
      toggleFavorite("ep-1")
      recordActivity(3, TODAY)
    })
    expect(favorites.result.current).toEqual(["ep-1"])
    expect(activity.result.current?.minutesByDate[TODAY]).toBe(3)
  })

  it("stop listening after unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener")
    const { unmount } = renderHook(() => useWords())
    unmount()
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function))
    expect(remove).toHaveBeenCalledWith("podmind:change", expect.any(Function))
  })

  it("pick up changes made in another tab", () => {
    const { result } = renderHook(() => useProfile())
    act(() => {
      window.localStorage.setItem("podmind:profile", JSON.stringify({ englishLevel: "C2" }))
      window.dispatchEvent(new StorageEvent("storage", { key: "podmind:profile" }))
    })
    expect(result.current?.englishLevel).toBe("C2")
  })
})