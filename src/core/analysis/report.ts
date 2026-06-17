import type { Segment, SegmentStatus, TMEntry } from '@/core/types'
import { findMatches } from '@/core/tm/match'
import { repeatedIndices } from '@/core/segments/repetition'
import { countChars, countWords } from './wordcount'

// Pre-translation analysis, in the spirit of memoQ's analysis table: it
// categorizes the document by how much help the TM offers, so a translator can
// gauge effort. Everything is computed client-side from the project's segments
// and the current TM.

export type LeverageBucket = 'repetition' | 'exact' | 'high' | 'medium' | 'low' | 'none'

export const LEVERAGE_BUCKETS: LeverageBucket[] = [
  'repetition',
  'exact',
  'high',
  'medium',
  'low',
  'none',
]

export const LEVERAGE_LABELS: Record<LeverageBucket, string> = {
  repetition: 'Repetitions',
  exact: '100% (exact)',
  high: '95–99%',
  medium: '75–94%',
  low: '50–74%',
  none: 'No match',
}

export interface BucketStat {
  segments: number
  words: number
}

export interface AnalysisReport {
  totalSegments: number
  totalWords: number
  totalChars: number
  statusCounts: Record<SegmentStatus, number>
  leverage: Record<LeverageBucket, BucketStat>
}

const ZERO_STATUS: Record<SegmentStatus, number> = {
  untranslated: 0,
  draft: 0,
  translated: 0,
  reviewed: 0,
  locked: 0,
}

function emptyLeverage(): Record<LeverageBucket, BucketStat> {
  return {
    repetition: { segments: 0, words: 0 },
    exact: { segments: 0, words: 0 },
    high: { segments: 0, words: 0 },
    medium: { segments: 0, words: 0 },
    low: { segments: 0, words: 0 },
    none: { segments: 0, words: 0 },
  }
}

export function bucketForScore(score: number): LeverageBucket {
  if (score >= 1) return 'exact'
  if (score >= 0.95) return 'high'
  if (score >= 0.75) return 'medium'
  if (score >= 0.5) return 'low'
  return 'none'
}

/**
 * Build the analysis report. Each segment is placed in exactly one leverage
 * bucket: a 2nd+ occurrence of an identical source counts as a repetition;
 * otherwise it is bucketed by its best TM match score. Word counts use the
 * source text in `sourceLang`.
 */
export function analyzeProject(
  segments: Segment[],
  tmEntries: TMEntry[],
  opts: { sourceLang: string; targetLang: string },
): AnalysisReport {
  const candidates = tmEntries.filter(
    (e) => e.sourceLang === opts.sourceLang && e.targetLang === opts.targetLang,
  )
  const repeats = repeatedIndices(segments)
  const leverage = emptyLeverage()
  const statusCounts = { ...ZERO_STATUS }

  let totalWords = 0
  let totalChars = 0

  segments.forEach((seg, i) => {
    statusCounts[seg.status] += 1
    const words = countWords(seg.source, opts.sourceLang)
    totalWords += words
    totalChars += countChars(seg.source, { includeWhitespace: false })

    let bucket: LeverageBucket
    if (repeats.has(i)) {
      bucket = 'repetition'
    } else if (!seg.source.trim() || candidates.length === 0) {
      bucket = 'none'
    } else {
      const [best] = findMatches(seg.source, candidates, { threshold: 0.5, limit: 1 })
      bucket = best ? bucketForScore(best.score) : 'none'
    }
    leverage[bucket].segments += 1
    leverage[bucket].words += words
  })

  return {
    totalSegments: segments.length,
    totalWords,
    totalChars,
    statusCounts,
    leverage,
  }
}
