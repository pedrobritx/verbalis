import type { Segment, SegmentStatus } from '@/core/types'

// Pure helpers for segment-handling operations (split / join). The actual DB
// mutations live in segmentRepo, which re-indexes siblings inside a transaction;
// these functions keep the decision logic testable in isolation.

const STATUS_RANK: Record<SegmentStatus, number> = {
  untranslated: 0,
  draft: 1,
  translated: 2,
  reviewed: 3,
  // `locked` is a legacy status value; lock is now an orthogonal flag. Rank it
  // alongside untranslated so it never wins a merge.
  locked: 0,
}

/**
 * The status a merged segment should take: the *less complete* of its parts.
 * Joining a reviewed segment with an untranslated one yields untranslated, so
 * the translator is forced to look at the combined result.
 */
export function mergeStatus(a: SegmentStatus, b: SegmentStatus): SegmentStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b
}

/**
 * Two adjacent segments may be joined only when they belong to the same source
 * block (paragraph / heading / list item). Joining across blocks would merge,
 * say, a heading into a paragraph. When block metadata is absent (e.g. XLIFF),
 * the caller gates joining by other means, so this returns true.
 */
export function canJoin(a: Segment, b: Segment): boolean {
  const aBlock = a.sourceMeta?.blockIndex
  const bBlock = b.sourceMeta?.blockIndex
  if (aBlock === undefined || bBlock === undefined) return true
  return aBlock === bBlock
}

export interface SplitParts {
  left: string
  right: string
}

/**
 * Split a source string at `offset`, trimming whitespace at the cut so neither
 * side starts or ends with the boundary space. Returns null when the offset
 * would leave either side empty (nothing to split).
 */
export function splitSourceText(source: string, offset: number): SplitParts | null {
  if (offset <= 0 || offset >= source.length) return null
  const left = source.slice(0, offset).replace(/\s+$/, '')
  const right = source.slice(offset).replace(/^\s+/, '')
  if (!left || !right) return null
  return { left, right }
}
