import type { TMEntry } from '@/core/types'

// Concordance search: free-text lookup across the TM so a translator can see
// "how did I translate this phrase before?". Case-insensitive by default and,
// unlike fuzzy matching, it preserves character offsets so the UI can highlight
// the hit in context.

export type ConcordanceField = 'source' | 'target' | 'both'

export interface ConcordanceMatch {
  entry: TMEntry
  field: 'source' | 'target'
  start: number
  end: number
}

export interface ConcordanceOptions {
  field?: ConcordanceField
  caseSensitive?: boolean
  limit?: number
}

export function concordance(
  query: string,
  entries: TMEntry[],
  opts: ConcordanceOptions = {},
): ConcordanceMatch[] {
  const field = opts.field ?? 'both'
  const limit = opts.limit ?? 50
  const raw = query.trim()
  if (!raw) return []
  const needle = opts.caseSensitive ? raw : raw.toLowerCase()

  const results: ConcordanceMatch[] = []
  const scan = (entry: TMEntry, which: 'source' | 'target') => {
    const value = entry[which]
    const hay = opts.caseSensitive ? value : value.toLowerCase()
    const idx = hay.indexOf(needle)
    if (idx >= 0) {
      results.push({ entry, field: which, start: idx, end: idx + raw.length })
    }
  }

  for (const entry of entries) {
    if (field === 'source' || field === 'both') scan(entry, 'source')
    if (results.length >= limit) break
    if (field === 'target' || field === 'both') scan(entry, 'target')
    if (results.length >= limit) break
  }

  return results.slice(0, limit)
}
