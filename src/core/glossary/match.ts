import type { GlossaryEntry } from '@/core/types'
import { GLOSSARY_MIN_TERM_LENGTH } from './constants'

export interface GlossaryHit {
  entry: GlossaryEntry
  start: number
  end: number
}

interface FindOptions {
  limit: number
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findGlossaryHits(
  source: string,
  entries: GlossaryEntry[],
  opts: FindOptions,
): GlossaryHit[] {
  if (!source || !source.trim() || entries.length === 0) return []

  const normalized = source.normalize('NFC')
  const hits: GlossaryHit[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const term = entry.term.normalize('NFC').trim()
    if (term.length < GLOSSARY_MIN_TERM_LENGTH) continue
    // Unicode-aware whole-word match: no letter/number adjacent on either side.
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, 'iu')
    const m = pattern.exec(normalized)
    if (!m) continue
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    hits.push({ entry, start: m.index, end: m.index + m[0].length })
    if (hits.length >= opts.limit) break
  }

  hits.sort((a, b) => a.start - b.start)
  return hits
}
