import { useMemo } from 'react'
import {
  buildCorpusIndex,
  findCorpusHits,
  keySideForSourceLang,
  type CorpusHit,
} from '@/core/corpus/match'
import { baseLanguage } from '@/core/i18n/languages'
import { GLOSSARY_MAX_MATCHES } from '@/core/glossary/constants'
import { useCorpusCache } from './useCorpusCache'

// Corpus hits for the focused segment. The matched side follows the project
// source language (PT source matches the PT side of the PT->EN corpus, etc.).
export function useCorpusMatches(
  source: string | undefined,
  sourceLang: string | undefined,
): CorpusHit[] {
  const terms = useCorpusCache()

  const index = useMemo(() => {
    if (!terms || terms.length === 0) return null
    const termSourceLang = terms[0].sourceLang
    const keySide = keySideForSourceLang(
      sourceLang ? baseLanguage(sourceLang) : undefined,
      termSourceLang,
    )
    return buildCorpusIndex(terms, keySide)
  }, [terms, sourceLang])

  return useMemo(() => {
    if (!source || !source.trim() || !index) return []
    return findCorpusHits(source, index, { limit: GLOSSARY_MAX_MATCHES })
  }, [source, index])
}
