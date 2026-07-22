import type { GlossaryEntry } from '@/core/types'
import type { ParsedGlossaryRow } from './csv'

// OmegaT writable glossary format: tab-separated `source<TAB>target<TAB>comment`.
// Lines beginning with `#` are comments, blank lines are skipped. The file
// itself carries no language metadata; the importer supplies the project's
// source/target language codes.
export function parseTSV(
  text: string,
  sourceLang: string,
  targetLang: string,
): ParsedGlossaryRow[] {
  const rows: ParsedGlossaryRow[] = []
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue
    if (line.startsWith('#')) continue
    const parts = line.split('\t')
    const term = (parts[0] ?? '').trim()
    if (!term) continue
    const translation = (parts[1] ?? '').trim()
    const notes = (parts[2] ?? '').trim()
    rows.push({
      term,
      definition: '',
      sourceLang,
      targetLang: translation ? targetLang : undefined,
      translation: translation || undefined,
      notes: notes || undefined,
    })
  }
  return rows
}

export function exportTSV(entries: GlossaryEntry[], targetLang: string): string {
  const lines: string[] = []
  for (const e of entries) {
    const translation = e.translations[targetLang]
    if (!translation) continue
    // OmegaT can't represent tabs/newlines inside a cell; collapse to spaces.
    const cells = [e.term, translation, e.notes ?? ''].map((v) => v.replace(/[\t\r\n]+/g, ' '))
    lines.push(cells.join('\t'))
  }
  return lines.join('\n') + (lines.length ? '\n' : '')
}
