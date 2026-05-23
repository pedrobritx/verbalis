import { useMemo } from 'react'
import { findGlossaryHits, type GlossaryHit } from '@/core/glossary/match'
import { GLOSSARY_MAX_MATCHES } from '@/core/glossary/constants'
import { useGlossaryCache } from './useGlossaryCache'

export function useGlossaryMatches(
  source: string | undefined,
  projectId: string | undefined,
): GlossaryHit[] {
  const cache = useGlossaryCache(projectId)
  return useMemo(() => {
    if (!source || !source.trim() || !cache) return []
    return findGlossaryHits(source, cache, { limit: GLOSSARY_MAX_MATCHES })
  }, [source, cache])
}
