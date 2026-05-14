// Supported native languages. Add more as you want to expand to other markets.
// 'code' is the ISO 639-1 code we'll pass to DeepL for translations.
export const NATIVE_LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'es', label: 'Español', english: 'Spanish' },
  { code: 'zh', label: '中文', english: 'Chinese' },
  { code: 'ja', label: '日本語', english: 'Japanese' },
  { code: 'ko', label: '한국어', english: 'Korean' },
  { code: 'fr', label: 'Français', english: 'French' },
  { code: 'de', label: 'Deutsch', english: 'German' },
  { code: 'pt', label: 'Português', english: 'Portuguese' },
  { code: 'ru', label: 'Русский', english: 'Russian' },
  { code: 'ar', label: 'العربية', english: 'Arabic' },
] as const

// CEFR levels — the European standard for measuring language proficiency
export const ENGLISH_LEVELS = [
  { code: 'A1', label: 'A1 — Beginner', description: 'Basic phrases and everyday expressions' },
  { code: 'A2', label: 'A2 — Elementary', description: 'Simple conversations on familiar topics' },
  { code: 'B1', label: 'B1 — Intermediate', description: 'Most situations while traveling or working' },
  { code: 'B2', label: 'B2 — Upper-Intermediate', description: 'Complex topics and abstract discussions' },
  { code: 'C1', label: 'C1 — Advanced', description: 'Fluent in academic and professional contexts' },
  { code: 'C2', label: 'C2 — Proficient', description: 'Near-native, including subtle nuances' },
] as const