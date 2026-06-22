import nspell from 'nspell'

// Thin wrapper over nspell (a pure-JS, Hunspell-compatible checker). Kept tiny
// and dependency-injectable so the Web Worker and unit tests share one surface.
// Spelling never leaves the device: the dictionaries are bundled static assets.

export interface SpellChecker {
  /** True when the word is spelled correctly (or is in the personal list). */
  correct(word: string): boolean
  /** Ordered correction suggestions for a misspelled word. */
  suggest(word: string): string[]
  /** Add a word to this checker (personal dictionary, this session). */
  add(word: string): void
}

/** Build a checker from raw Hunspell affix + dictionary data. */
export function createChecker(
  aff: string | Uint8Array,
  dic: string | Uint8Array,
  personalWords: string[] = [],
): SpellChecker {
  const spell = nspell(aff, dic)
  for (const w of personalWords) if (w) spell.add(w)
  return {
    correct: (word) => spell.correct(word),
    suggest: (word) => spell.suggest(word),
    add: (word) => {
      spell.add(word)
    },
  }
}
