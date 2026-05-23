import type { TMEntry, TMMatch } from '@/core/types'
import { normalize, similarityRatio } from './similarity'

interface FindMatchesOptions {
  threshold: number
  limit: number
}

export function findMatches(
  query: string,
  candidates: TMEntry[],
  opts: FindMatchesOptions,
): TMMatch[] {
  const q = normalize(query)
  if (q.length === 0) return []

  const results: TMMatch[] = []
  for (const entry of candidates) {
    const candidate = normalize(entry.source)
    // Length-based prefilter: if even a perfect alignment can't reach the threshold, skip.
    const maxLen = Math.max(q.length, candidate.length)
    if (maxLen === 0) continue
    const minLen = Math.min(q.length, candidate.length)
    const lengthCeiling = minLen / maxLen
    if (lengthCeiling < opts.threshold) continue

    const score = q === candidate ? 1 : similarityRatio(q, candidate)
    if (score < opts.threshold) continue
    results.push({ entry, score, isExact: score === 1 })
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.entry.date.localeCompare(a.entry.date)
  })

  return results.slice(0, opts.limit)
}
