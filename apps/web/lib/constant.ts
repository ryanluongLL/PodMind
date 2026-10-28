/// Native languages offered during onboarding. "code" is the DeepL
/// translation target. Kept short on purpose: these are the largest
/// English learner groups, and all are supported by DeepL.
export const NATIVE_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "zh", label: "中文", english: "Chinese" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "pt", label: "Português", english: "Portuguese" },
] as const

export type NativeLanguageCode = (typeof NATIVE_LANGUAGES)[number]["code"]

/// CEFR levels, described as what the learner can actually do.
/// knownWords is a rough estimate of how many of the most frequent English
/// words a learner at that level knows. The coverage recommender will use it
/// to estimate how much of an episode the learner can understand.
export const ENGLISH_LEVELS = [
  {
    code: "A1",
    label: "A1 · Beginner",
    description: "I know basic words and a few simple phrases.",
    knownWords: 500,
  },
  {
    code: "A2",
    label: "A2 · Elementary",
    description: "I can follow slow, simple talk about everyday things.",
    knownWords: 1000,
  },
  {
    code: "B1",
    label: "B1 · Intermediate",
    description: "I understand the main points when people speak clearly.",
    knownWords: 2000,
  },
  {
    code: "B2",
    label: "B2 · Upper intermediate",
    description: "I can follow most podcasts but miss some words and jokes.",
    knownWords: 4000,
  },
  {
    code: "C1",
    label: "C1 · Advanced",
    description: "I understand almost everything, even fast natural speech.",
    knownWords: 8000,
  },
  {
    code: "C2",
    label: "C2 · Proficient",
    description: "I understand everything without effort, like a native speaker.",
    knownWords: 16000,
  },
] as const

export type EnglishLevelCode = (typeof ENGLISH_LEVELS)[number]["code"]