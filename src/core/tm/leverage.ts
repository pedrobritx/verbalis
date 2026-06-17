import type { Segment, TMEntry } from '@/core/types'
import { findMatches } from './match'

export interface PretranslateHit {
  segmentId: string
  index: number
  target: string
  score: number
  isExact: boolean
}

/**
 * For every still-untranslated segment, find its best TM match at/above
 * `minScore` and return the proposed target. Exact matches (score 1) are meant
 * to land as `translated`; fuzzy matches as `draft` — the caller decides. TM
 * entries should already be filtered to the project's language pair.
 */
export function pretranslate(
  segments: Segment[],
  tmEntries: TMEntry[],
  opts: { minScore: number },
): PretranslateHit[] {
  if (tmEntries.length === 0) return []
  const hits: PretranslateHit[] = []
  for (const seg of segments) {
    if (seg.status !== 'untranslated') continue
    if (!seg.source.trim()) continue
    const [best] = findMatches(seg.source, tmEntries, { threshold: opts.minScore, limit: 1 })
    if (!best) continue
    hits.push({
      segmentId: seg.id,
      index: seg.index,
      target: best.entry.target,
      score: best.score,
      isExact: best.isExact,
    })
  }
  return hits
}
