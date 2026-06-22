import { expose } from 'comlink'
import { createChecker, type SpellChecker } from '@/core/spell/engine'

// Holds one nspell checker per language, off the main thread (building a checker
// parses a multi-MB dictionary). The main thread fetches the raw dictionary
// (so offline gating + the SW cache are uniform) and hands the text in via load().

const checkers = new Map<string, SpellChecker>()

const spellApi = {
  /** Build (or rebuild) the checker for a language. Idempotent per (lang, words). */
  load: (lang: string, aff: string, dic: string, personalWords: string[] = []): boolean => {
    checkers.set(lang, createChecker(aff, dic, personalWords))
    return true
  },
  isLoaded: (lang: string): boolean => checkers.has(lang),
  /** Return the subset of `words` that are misspelled (preserving order). */
  checkMany: (lang: string, words: string[]): string[] => {
    const c = checkers.get(lang)
    if (!c) return []
    return words.filter((w) => !c.correct(w))
  },
  suggest: (lang: string, word: string): string[] => {
    const c = checkers.get(lang)
    return c ? c.suggest(word) : []
  },
  add: (lang: string, word: string): void => {
    checkers.get(lang)?.add(word)
  },
}

export type SpellWorker = typeof spellApi
expose(spellApi)
