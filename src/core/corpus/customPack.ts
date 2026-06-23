import type { GlossaryEntry } from '@/core/types'
import type { CorpusPackFile, CorpusTerm, CorpusTermTuple } from './types'

/** Stable id for a user-uploaded corpus, namespaced so it never clashes with a
 *  bundled pack (e.g. "competition") or another field. */
export function slugifyCorpusId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `custom:${slug || 'corpus'}`
}

type ParsedRow = Pick<GlossaryEntry, 'term' | 'translations' | 'notes'>

/**
 * Turn parsed glossary rows (the shape the CSV/TSV/TBX parsers already produce)
 * into a CorpusPackFile. For each row the source is the term and the target is
 * the chosen target-language translation (exact tag → base language → first
 * available); rows without a usable pair are dropped.
 */
export function rowsToCorpusFile(
  rows: ParsedRow[],
  opts: { id: string; langSource: string; langTarget: string },
): CorpusPackFile {
  const base = opts.langTarget.split('-')[0]
  const terms: CorpusTermTuple[] = []
  for (const r of rows) {
    const source = r.term?.trim()
    if (!source) continue
    const target =
      r.translations[opts.langTarget] ??
      Object.entries(r.translations).find(([l]) => l.split('-')[0] === base)?.[1] ??
      Object.values(r.translations)[0]
    if (!target?.trim()) continue
    terms.push([source, target.trim(), 'custom', r.notes ?? ''])
  }
  return { id: opts.id, langSource: opts.langSource, langTarget: opts.langTarget, terms }
}

/** Adapt installed corpus terms to GlossaryEntry shape so the glossary CSV/TSV/TBX
 *  exporters can serialize them for download. */
export function corpusTermsToGlossaryEntries(terms: CorpusTerm[]): GlossaryEntry[] {
  return terms.map((t) => ({
    id: t.id,
    term: t.source,
    definition: '',
    translations: { [t.targetLang]: t.target },
    notes: t.note,
  }))
}
