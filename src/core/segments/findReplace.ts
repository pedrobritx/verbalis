import type { Segment } from '@/core/types'
import { escapeRegex } from '@/core/glossary/match'

// Project-wide find & replace over segment targets — the cross-file search
// memoQ highlights as a CAT advantage over a word processor. Pure helpers here;
// the dialog applies the previewed changes through segmentRepo. Locked segments
// are never touched.

export interface FindReplaceOptions {
  find: string
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export interface ReplacePreviewRow {
  segmentId: string
  index: number
  before: string
  after: string
  count: number
}

/** Build the search RegExp. Returns null when the pattern is empty or invalid. */
export function buildPattern(opts: FindReplaceOptions): RegExp | null {
  if (!opts.find) return null
  let body = opts.regex ? opts.find : escapeRegex(opts.find)
  if (opts.wholeWord) body = `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`
  const flags = `gu${opts.caseSensitive ? '' : 'i'}`
  try {
    return new RegExp(body, flags)
  } catch {
    return null
  }
}

function countMatches(pattern: RegExp, text: string): number {
  pattern.lastIndex = 0
  let n = 0
  while (pattern.exec(text) !== null) {
    n += 1
    if (pattern.lastIndex === 0) break // zero-width safety
  }
  return n
}

/**
 * Compute the would-be replacements across the given segments' targets. Only
 * segments whose target actually changes are returned. Locked segments are
 * excluded.
 */
export function previewReplace(
  segments: Segment[],
  opts: FindReplaceOptions,
  replacement: string,
): ReplacePreviewRow[] {
  const pattern = buildPattern(opts)
  if (!pattern) return []
  const rows: ReplacePreviewRow[] = []
  for (const seg of segments) {
    if (seg.status === 'locked') continue
    if (!seg.target) continue
    const count = countMatches(pattern, seg.target)
    if (count === 0) continue
    pattern.lastIndex = 0
    const after = seg.target.replace(pattern, replacement)
    if (after === seg.target) continue
    rows.push({ segmentId: seg.id, index: seg.index, before: seg.target, after, count })
  }
  return rows
}
