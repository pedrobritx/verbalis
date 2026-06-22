import { getSpellWorker } from '@/workers/client'
import { fetchDictionary, type SpellLang } from './dictionaries'

// One dictionary load per language, shared across the app. Both the Spelling
// panel and the per-segment rich-editor squiggle overlay call this, so the
// multi-MB dictionary is fetched + parsed once, not once per consumer.

const loads = new Map<SpellLang, Promise<boolean>>()

/** Ensure the worker has a checker for `lang`, loading it once. */
export function ensureDictionaryLoaded(lang: SpellLang, personalWords: string[] = []): Promise<boolean> {
  const existing = loads.get(lang)
  if (existing) return existing
  const p = (async () => {
    const { aff, dic } = await fetchDictionary(lang)
    await getSpellWorker().load(lang, aff, dic, personalWords)
    return true
  })().catch((err) => {
    // Allow a later retry (e.g. once back online) by dropping the failed promise.
    loads.delete(lang)
    throw err
  })
  loads.set(lang, p)
  return p
}

/** Test-only: forget memoized loads. */
export function __resetSpellLoaderForTest(): void {
  loads.clear()
}
