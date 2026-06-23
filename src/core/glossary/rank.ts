import type { GlossaryEntry } from '@/core/types'
import { normalize } from '@/core/tm/similarity'

export interface TranslationCandidate {
  /** A single sense to insert (multi-sense values are split into separate ones). */
  value: string
  /** Language code the candidate came from. */
  lang: string
  /** Combined heuristic score; higher ranks first. */
  score: number
  /** Short human tags explaining the ranking (e.g. "target language", "context"). */
  reasons: string[]
}

// Glossary translation values often pack several senses into one field, e.g.
// "bank; shore" or "claim, demand". Splitting on these separators turns each
// sense into its own pickable candidate instead of inserting the whole list.
const SENSE_SEPARATOR = /\s*[;/|]\s*|,\s+/

function tokenize(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 2)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter += 1
  return inter / (a.size + b.size - inter)
}

/** Split a translation value into individual senses, preserving order. */
export function splitSenses(value: string): string[] {
  const parts = value
    .split(SENSE_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : value.trim() ? [value.trim()] : []
}

/**
 * Rank a glossary entry's candidate translations for the current target language
 * and segment context, fully offline. Combines three cheap local signals:
 *   - language affinity (exact target > base-language > other),
 *   - sense order (earlier senses are usually the primary meaning),
 *   - context overlap between the entry's gloss/notes and the surrounding segment.
 * Returns de-duplicated candidates sorted best-first.
 */
export function rankTranslations(
  entry: GlossaryEntry,
  ctx: { targetLang: string; segment?: string },
): TranslationCandidate[] {
  const base = ctx.targetLang.split('-')[0]
  const segmentTokens = new Set(tokenize(ctx.segment ?? ''))
  const glossTokens = new Set([...tokenize(entry.definition ?? ''), ...tokenize(entry.notes ?? '')])
  const contextScore = jaccard(segmentTokens, glossTokens)

  const byValue = new Map<string, TranslationCandidate>()

  for (const [lang, raw] of Object.entries(entry.translations)) {
    if (!raw?.trim()) continue

    let langScore: number
    const langReason: string[] = []
    if (lang === ctx.targetLang) {
      langScore = 1
      langReason.push('target language')
    } else if (lang.split('-')[0] === base) {
      langScore = 0.7
      langReason.push(lang)
    } else {
      langScore = 0.25
      langReason.push(lang)
    }

    const senses = splitSenses(raw)
    senses.forEach((value, i) => {
      const orderScore = senses.length > 1 ? 1 - (i / senses.length) * 0.5 : 1
      const reasons = [...langReason]
      if (contextScore > 0) reasons.push('context')
      const score = langScore * 2 + orderScore + contextScore

      const key = normalize(value)
      const existing = byValue.get(key)
      if (!existing || score > existing.score) {
        byValue.set(key, { value, lang, score, reasons })
      }
    })
  }

  return [...byValue.values()].sort((a, b) => b.score - a.score)
}
