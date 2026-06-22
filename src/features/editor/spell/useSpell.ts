import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpellWorker } from '@/workers/client'
import { fetchDictionary, resolveSpellLang, type SpellLang } from '@/core/spell/dictionaries'
import { tokenizeWords, type WordToken } from '@/core/spell/tokenize'

export type SpellState = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported'

/**
 * Loads the bundled dictionary for the project's target language into the spell
 * worker (once per language) and exposes checking / suggesting. The dictionary is
 * a static asset cached by the service worker, so after first use it works offline.
 */
export function useSpell(targetLang: string, enabled: boolean, personalWords: string[]) {
  const lang = resolveSpellLang(targetLang)
  const [state, setState] = useState<SpellState>('idle')
  const loadedRef = useRef<SpellLang | null>(null)

  useEffect(() => {
    if (!enabled) {
      setState('idle')
      return
    }
    if (!lang) {
      setState('unsupported')
      return
    }
    if (loadedRef.current === lang) {
      setState('ready')
      return
    }
    let active = true
    setState('loading')
    void (async () => {
      try {
        const worker = getSpellWorker()
        const { aff, dic } = await fetchDictionary(lang)
        await worker.load(lang, aff, dic, personalWords)
        if (!active) return
        loadedRef.current = lang
        setState('ready')
      } catch {
        if (active) setState('error')
      }
    })()
    return () => {
      active = false
    }
    // personalWords intentionally excluded — added incrementally via addWord, not
    // by reparsing the multi-MB dictionary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, enabled])

  const check = useCallback(
    async (text: string): Promise<WordToken[]> => {
      if (!lang || state !== 'ready') return []
      const tokens = tokenizeWords(text)
      if (tokens.length === 0) return []
      const unique = Array.from(new Set(tokens.map((t) => t.word)))
      const misspelled = new Set(await getSpellWorker().checkMany(lang, unique))
      return tokens.filter((t) => misspelled.has(t.word))
    },
    [lang, state],
  )

  const suggest = useCallback(
    async (word: string): Promise<string[]> => {
      if (!lang || state !== 'ready') return []
      return getSpellWorker().suggest(lang, word)
    },
    [lang, state],
  )

  const addWord = useCallback(
    async (word: string): Promise<void> => {
      if (!lang) return
      await getSpellWorker().add(lang, word)
    },
    [lang],
  )

  return { lang, state, check, suggest, addWord }
}
