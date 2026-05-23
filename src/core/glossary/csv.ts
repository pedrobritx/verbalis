import type { GlossaryEntry } from '@/core/types'

export interface ParsedGlossaryRow {
  term: string
  definition: string
  sourceLang?: string
  targetLang?: string
  translation?: string
  notes?: string
}

const HEADERS = ['term', 'definition', 'sourceLang', 'targetLang', 'translation', 'notes']

// Tokenize a CSV file into rows of cells. Handles quoted values, embedded commas,
// embedded newlines inside quotes, escaped quotes ("") and CRLF/LF line endings.
function tokenize(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (c === '\r') {
      if (text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += c
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function parseCSV(text: string): ParsedGlossaryRow[] {
  const rows = tokenize(text)
  if (rows.length === 0) return []
  const header = rows[0].map((c) => c.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name.toLowerCase())
  const termIdx = idx('term')
  if (termIdx === -1) {
    throw new Error('Invalid CSV: missing "term" column')
  }
  const defIdx = idx('definition')
  const slIdx = idx('sourcelang')
  const tlIdx = idx('targetlang')
  const trIdx = idx('translation')
  const nIdx = idx('notes')

  const out: ParsedGlossaryRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const term = (r[termIdx] ?? '').trim()
    if (!term) continue
    out.push({
      term,
      definition: defIdx === -1 ? '' : (r[defIdx] ?? '').trim(),
      sourceLang: slIdx === -1 ? undefined : (r[slIdx] ?? '').trim() || undefined,
      targetLang: tlIdx === -1 ? undefined : (r[tlIdx] ?? '').trim() || undefined,
      translation: trIdx === -1 ? undefined : (r[trIdx] ?? '').trim() || undefined,
      notes: nIdx === -1 ? undefined : (r[nIdx] ?? '').trim() || undefined,
    })
  }
  return out
}

// Fold parsed rows into glossary entries: rows sharing the same (term, projectId)
// are merged so multiple translations on separate rows produce one entry.
export function mergeRows(
  rows: ParsedGlossaryRow[],
  projectId?: string,
): Array<Omit<GlossaryEntry, 'id'>> {
  const byKey = new Map<string, Omit<GlossaryEntry, 'id'>>()
  for (const r of rows) {
    const key = r.term.toLowerCase()
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        term: r.term,
        definition: r.definition,
        translations: {},
        notes: r.notes,
        projectId,
      }
      byKey.set(key, entry)
    } else {
      if (!entry.definition && r.definition) entry.definition = r.definition
      if (!entry.notes && r.notes) entry.notes = r.notes
    }
    if (r.targetLang && r.translation) {
      entry.translations[r.targetLang] = r.translation
    }
  }
  return Array.from(byKey.values())
}

function escapeCSV(value: string): string {
  if (value === '') return ''
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportCSV(entries: GlossaryEntry[], sourceLang?: string): string {
  const lines: string[] = []
  lines.push(HEADERS.join(','))
  for (const e of entries) {
    const langs = Object.keys(e.translations)
    if (langs.length === 0) {
      lines.push(
        [
          escapeCSV(e.term),
          escapeCSV(e.definition),
          escapeCSV(sourceLang ?? ''),
          '',
          '',
          escapeCSV(e.notes ?? ''),
        ].join(','),
      )
      continue
    }
    for (const lang of langs) {
      lines.push(
        [
          escapeCSV(e.term),
          escapeCSV(e.definition),
          escapeCSV(sourceLang ?? ''),
          escapeCSV(lang),
          escapeCSV(e.translations[lang]),
          escapeCSV(e.notes ?? ''),
        ].join(','),
      )
    }
  }
  return lines.join('\n') + '\n'
}
