import { useMemo } from 'react'
import type { TMMatch } from '@/core/types'
import { findMatches } from '@/core/tm/match'
import { TM_MAX_MATCHES, TM_MIN_SIMILARITY } from '@/core/tm/constants'
import { useTMCache } from './useTMCache'

export function useTMMatches(
  source: string | undefined,
  sourceLang: string | undefined,
  targetLang: string | undefined,
): TMMatch[] {
  const cache = useTMCache(sourceLang, targetLang)
  return useMemo(() => {
    if (!source || !source.trim() || !cache) return []
    return findMatches(source, cache, {
      threshold: TM_MIN_SIMILARITY,
      limit: TM_MAX_MATCHES,
    })
  }, [source, cache])
}
