import type { MTProviderId, MTSettings } from '@/core/types'
import { translateWith } from '@/core/mt'
import { normalize, similarityRatio } from '@/core/tm/similarity'
import type { TranslationCandidate } from './rank'

/**
 * Optional, opt-in AI re-ranking of glossary candidates. Rather than depend on a
 * bespoke chat endpoint, it reuses the configured MT provider (Claude/Ollama/…)
 * to translate the *whole segment in context*, then boosts the candidate that
 * best matches that contextual translation. This keeps the local-first contract
 * (Ollama stays on-device) and degrades gracefully — on any provider error the
 * original local ranking is returned unchanged.
 */
export async function llmRankCandidates(
  candidates: TranslationCandidate[],
  ctx: {
    source: string
    segment: string
    sourceLang: string
    targetLang: string
    providerId: MTProviderId
    settings: MTSettings
  },
): Promise<TranslationCandidate[]> {
  if (candidates.length <= 1) return candidates

  const res = await translateWith(
    ctx.providerId,
    {
      text: ctx.segment.trim() || ctx.source,
      sourceLang: ctx.sourceLang,
      targetLang: ctx.targetLang,
    },
    ctx.settings,
  )

  const mt = normalize(res.text)
  const mtWords = mt.split(' ').filter(Boolean)

  const reranked = candidates.map((c) => {
    const value = normalize(c.value)
    const reasons = [...c.reasons]
    let boost = 0
    if (value && mt.includes(value)) {
      // The contextual translation literally contains this sense.
      boost = 2
      reasons.push('AI match')
    } else {
      // Otherwise reward the sense closest to any word the model produced.
      const best = mtWords.reduce((max, w) => Math.max(max, similarityRatio(value, w)), 0)
      boost = best
      if (best > 0.8) reasons.push('AI match')
    }
    return { ...c, score: c.score + boost, reasons: [...new Set(reasons)] }
  })

  return reranked.sort((a, b) => b.score - a.score)
}
