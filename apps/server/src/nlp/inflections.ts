/// Generates the common inflected forms of a word so a search for "disciple"
/// also finds "disciples", and "carry" also finds "carries" and "carried".
/// This is intentionally simple: it covers regular English inflection, and
/// the surface form the learner clicked is always included as well.
export function inflections(lemma: string, surface: string): string[] {
  const base = lemma.toLowerCase()
  const forms = new Set<string>()
  forms.add(base)
  forms.add(surface.toLowerCase())
  forms.add(`${base}s`)
  forms.add(`${base}es`)
  forms.add(`${base}ed`)
  forms.add(`${base}d`)
  forms.add(`${base}ing`)

  if (base.endsWith("e")) {
    forms.add(`${base.slice(0, -1)}ing`)
  }

  /// Consonant followed by y: carry becomes carries and carried
  if (/[^aeiou]y$/.test(base)) {
    const stem = base.slice(0, -1)
    forms.add(`${stem}ies`)
    forms.add(`${stem}ied`)
  }

  /// Only plain words, since these go into a database regular expression
  const clean: string[] = []
  for (const form of forms) {
    if (/^[a-z'-]+$/.test(form)) {
      clean.push(form)
    }
  }
  return clean
}

/// Postgres regex matching any form as a whole word. \m and \M are word
/// boundaries, so "run" does not match "brunch". Returns null when there is
/// nothing safe to search for.
export function inflectionPattern(lemma: string, surface: string): string | null {
  const forms = inflections(lemma, surface)
  if (forms.length === 0) {
    return null
  }
  return `\\m(${forms.join("|")})\\M`
}