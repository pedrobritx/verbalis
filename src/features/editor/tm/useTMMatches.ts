import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { TMMatch } from '@/core/types'
import { findMatches } from '@/core/tm/match'
import { findSemanticMatches, mergeMatches } from '@/core/tm/semantic'
import { TM_MAX_MATCHES, TM_MIN_SIMILARITY } from '@/core/tm/constants'
import {
  SEMANTIC_TM_KEY,
  mergeSemanticTMSettings,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'
import { getEmbeddingsWorker } from '@/workers/client'
import type { SemanticTMSettings } from '@/core/types'
import { useTMCache } from './useTMCache'

export function useTMMatches(
  source: string | undefined,
  sourceLang: string | undefined,
  targetLang: string | undefined,
): TMMatch[] {
  const cache = useTMCache(sourceLang, targetLang)

  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<SemanticTMSettings>>(SEMANTIC_TM_KEY),
    [],
  )
  const semantic = useMemo(() => mergeSemanticTMSettings(stored), [stored])

  const lexical = useMemo<TMMatch[]>(() => {
    if (!source || !source.trim() || !cache) return []
    return findMatches(source, cache, {
      threshold: TM_MIN_SIMILARITY,
      limit: TM_MAX_MATCHES,
    }).map((m) => ({ ...m, similarityMethod: 'lexical' as const }))
  }, [source, cache])

  const [combined, setCombined] = useState<TMMatch[]>(lexical)

  useEffect(() => {
    setCombined(lexical)
    if (!semantic.enabled || !source || !source.trim() || !cache || cache.length === 0) {
      return
    }
    let cancelled = false
    const worker = getEmbeddingsWorker()
    findSemanticMatches(
      source,
      semantic.model,
      cache,
      { topK: TM_MAX_MATCHES, threshold: semantic.threshold },
      { embedAndRank: (q, m, c, k, t) => worker.embedAndRank(q, m, c, k, t) },
    )
      .then((sem) => {
        if (cancelled) return
        if (sem.length === 0) return
        setCombined(mergeMatches(lexical, sem, TM_MAX_MATCHES))
      })
      .catch(() => {
        // Semantic is best-effort — keep lexical results.
      })
    return () => {
      cancelled = true
    }
  }, [lexical, source, cache, semantic.enabled, semantic.model, semantic.threshold])

  return combined
}
