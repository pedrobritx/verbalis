import type { Segment } from '@/core/types'
import { normalize } from '@/core/tm/similarity'

// Repetition helpers shared by the QA "inconsistent repeats" rule, the
// auto-propagation on confirm, and the leverage analysis report. A "repetition"
// is a segment whose normalized source has already appeared earlier in the
// document, mirroring how CAT tools count repeated work only once.

/** Group segments by their normalized source. Empty sources are skipped. */
export function groupByNormalizedSource(segments: Segment[]): Map<string, Segment[]> {
  const map = new Map<string, Segment[]>()
  for (const seg of segments) {
    const key = normalize(seg.source)
    if (!key) continue
    const arr = map.get(key)
    if (arr) arr.push(seg)
    else map.set(key, [seg])
  }
  return map
}

/**
 * Indices (into `segments`) of entries that repeat an earlier identical source —
 * i.e. the 2nd and later occurrences. The first occurrence of each source is
 * never included.
 */
export function repeatedIndices(segments: Segment[]): Set<number> {
  const seen = new Set<string>()
  const repeats = new Set<number>()
  segments.forEach((seg, i) => {
    const key = normalize(seg.source)
    if (!key) return
    if (seen.has(key)) repeats.add(i)
    else seen.add(key)
  })
  return repeats
}
