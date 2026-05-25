import { describe, expect, it } from 'vitest'
import { mergeRows, parseCSV } from '@/core/glossary/csv'

describe('parseCSV — MultiTerm-style locale headers', () => {
  it('treats the first locale column as the term and the rest as translations', () => {
    const text = `EN,DE,FR\nhello,hallo,bonjour\nworld,welt,monde`
    const rows = parseCSV(text)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => ({ term: r.term, targetLang: r.targetLang, translation: r.translation }))).toEqual([
      { term: 'hello', targetLang: 'DE', translation: 'hallo' },
      { term: 'hello', targetLang: 'FR', translation: 'bonjour' },
      { term: 'world', targetLang: 'DE', translation: 'welt' },
      { term: 'world', targetLang: 'FR', translation: 'monde' },
    ])
    expect(rows.every((r) => r.sourceLang === 'EN')).toBe(true)
  })

  it('preserves Definition and Notes columns when present', () => {
    const text = `EN,DE,Definition,Notes\nhello,hallo,a greeting,casual`
    const rows = parseCSV(text)
    expect(rows).toHaveLength(1)
    expect(rows[0].definition).toBe('a greeting')
    expect(rows[0].notes).toBe('casual')
  })

  it('handles BCP-47 region subtags in headers (EN-US, pt-BR)', () => {
    const text = `EN-US,pt-BR\nhello,olá`
    const rows = parseCSV(text)
    expect(rows[0].sourceLang).toBe('EN-US')
    expect(rows[0].targetLang).toBe('pt-BR')
  })

  it('emits a term-only row when no translations are present', () => {
    const text = `EN,DE\nhello,\nworld,welt`
    const rows = parseCSV(text)
    const merged = mergeRows(rows)
    expect(merged).toHaveLength(2)
    expect(merged.find((e) => e.term === 'hello')?.translations).toEqual({})
    expect(merged.find((e) => e.term === 'world')?.translations).toEqual({ DE: 'welt' })
  })

  it('still throws when neither term nor locale columns are present', () => {
    const text = `definition,translation\nfoo,bar`
    expect(() => parseCSV(text)).toThrow(/term/i)
  })
})
