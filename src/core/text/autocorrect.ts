// AutoCorrect / abbreviation expansion. A pure, headless core: given the textarea
// value and caret after a character was typed, expand the just-completed word when
// it matches a rule (memoQ's AutoCorrect). Editable in Settings, off by default so
// it never surprises the translator with a replacement they didn't ask for.

export interface AutocorrectRule {
  /** The typed token to replace (whole word, e.g. "eg"). */
  from: string
  /** Its expansion (e.g. "e.g."). */
  to: string
}

export interface AutocorrectSettings {
  enabled: boolean
  rules: AutocorrectRule[]
}

// Seeded with common EN fixes plus a few PT shorthands. Disabled by default,
// partly because PT/EN shorthands can collide across a mixed-language project.
export const DEFAULT_AUTOCORRECT_RULES: AutocorrectRule[] = [
  { from: 'eg', to: 'e.g.' },
  { from: 'ie', to: 'i.e.' },
  { from: 'etc', to: 'etc.' },
  { from: 'teh', to: 'the' },
  { from: 'adn', to: 'and' },
  { from: 'dont', to: "don't" },
  { from: 'cant', to: "can't" },
  { from: 'wont', to: "won't" },
  { from: 'recieve', to: 'receive' },
  { from: 'seperate', to: 'separate' },
  { from: 'occured', to: 'occurred' },
  // Portuguese shorthands
  { from: 'pq', to: 'porque' },
  { from: 'vc', to: 'você' },
  { from: 'tbm', to: 'também' },
  { from: 'mto', to: 'muito' },
]

export const DEFAULT_AUTOCORRECT_SETTINGS: AutocorrectSettings = {
  enabled: false,
  rules: DEFAULT_AUTOCORRECT_RULES,
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch)
}

/** Match a typed token to a rule, preserving a leading capital (Eg → E.g.). */
function matchRule(token: string, rules: AutocorrectRule[]): string | null {
  for (const r of rules) {
    if (r.from && r.from === token) return r.to
  }
  const lower = token.toLowerCase()
  for (const r of rules) {
    if (!r.from || r.from.toLowerCase() !== lower) continue
    const first = token.charAt(0)
    const isCapitalized =
      first !== '' && first === first.toUpperCase() && first !== first.toLowerCase()
    return isCapitalized ? r.to.charAt(0).toUpperCase() + r.to.slice(1) : r.to
  }
  return null
}

/**
 * Apply AutoCorrect after a keystroke. `caret` is the position after the typed
 * character. Expansion only fires when the last typed character is a word
 * boundary (space, punctuation, newline) completing a word that matches a rule.
 * Returns the new value + caret, or null when nothing changes — so the caller
 * can keep its existing controlled-input path untouched on the common case.
 */
export function autocorrectOnInput(
  value: string,
  caret: number,
  rules: AutocorrectRule[],
): { value: string; caret: number } | null {
  if (caret <= 1 || caret > value.length) return null
  // The just-typed character must be a boundary, not part of the word.
  if (isWordChar(value[caret - 1])) return null

  const end = caret - 1
  let start = end
  while (start > 0 && isWordChar(value[start - 1])) start -= 1
  if (start === end) return null

  const token = value.slice(start, end)
  const replacement = matchRule(token, rules)
  if (replacement === null || replacement === token) return null

  const newValue = value.slice(0, start) + replacement + value.slice(end)
  const newCaret = caret + (replacement.length - token.length)
  return { value: newValue, caret: newCaret }
}
