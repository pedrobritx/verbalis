import { describe, expect, it } from 'vitest'
import { concordance } from '@/core/tm/concordance'
import type { TMEntry } from '@/core/types'

function tm(id: string, source: string, target: string): TMEntry {
  return { id, source, target, sourceLang: 'en', targetLang: 'es', date: '2024-01-01T00:00:00.000Z' }
}

const entries = [
  tm('a', 'The invoice total is due', 'El total de la factura'),
  tm('b', 'Please pay the invoice', 'Por favor pague la factura'),
  tm('c', 'unrelated content', 'contenido no relacionado'),
]

describe('concordance', () => {
  it('finds case-insensitive matches in source by default', () => {
    const out = concordance('INVOICE', entries)
    expect(out.map((m) => m.entry.id).sort()).toEqual(['a', 'b'])
    expect(out.every((m) => m.field === 'source')).toBe(true)
  })

  it('returns offsets that point at the match in the original text', () => {
    const [hit] = concordance('invoice', [entries[0]], { field: 'source' })
    expect(entries[0].source.slice(hit.start, hit.end)).toBe('invoice')
  })

  it('searches the target side when asked', () => {
    const out = concordance('factura', entries, { field: 'target' })
    expect(out.map((m) => m.entry.id).sort()).toEqual(['a', 'b'])
  })

  it('respects case sensitivity', () => {
    expect(concordance('INVOICE', entries, { caseSensitive: true })).toEqual([])
  })

  it('returns nothing for a blank query', () => {
    expect(concordance('   ', entries)).toEqual([])
  })

  it('honors the limit', () => {
    const out = concordance('invoice', entries, { field: 'source', limit: 1 })
    expect(out).toHaveLength(1)
  })
})
