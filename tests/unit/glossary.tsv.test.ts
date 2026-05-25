import { describe, expect, it } from 'vitest'
import { exportTSV, parseTSV } from '@/core/glossary/tsv'
import { mergeRows } from '@/core/glossary/csv'

describe('parseTSV', () => {
  it('parses term, translation, comment columns', () => {
    const text = `hello\thola\tcasual\nworld\tmundo\t`
    const rows = parseTSV(text, 'en', 'es')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      term: 'hello',
      translation: 'hola',
      sourceLang: 'en',
      targetLang: 'es',
      notes: 'casual',
    })
    expect(rows[1]).toMatchObject({ term: 'world', translation: 'mundo' })
    expect(rows[1].notes).toBeUndefined()
  })

  it('skips comment lines and blank lines', () => {
    const text = `# OmegaT glossary\nhello\thola\n\nworld\tmundo\n`
    expect(parseTSV(text, 'en', 'es')).toHaveLength(2)
  })

  it('allows term-only entries with no translation', () => {
    const text = `hello\nworld`
    const rows = parseTSV(text, 'en', 'es')
    expect(rows).toHaveLength(2)
    expect(rows[0].translation).toBeUndefined()
    expect(rows[0].targetLang).toBeUndefined()
  })

  it('handles CRLF line endings', () => {
    const rows = parseTSV('hello\thola\r\nworld\tmundo\r\n', 'en', 'es')
    expect(rows).toHaveLength(2)
  })

  it('feeds mergeRows so glossary entries form correctly', () => {
    const rows = parseTSV('hello\thola\ncolor\tcolor\n', 'en', 'es')
    const entries = mergeRows(rows)
    expect(entries).toHaveLength(2)
    expect(entries[0].translations).toEqual({ es: 'hola' })
  })
})

describe('exportTSV', () => {
  it('writes one line per entry for the chosen target language', () => {
    const out = exportTSV(
      [
        {
          id: 'a',
          term: 'hello',
          definition: '',
          translations: { es: 'hola', fr: 'bonjour' },
          notes: 'casual',
        },
        {
          id: 'b',
          term: 'world',
          definition: '',
          translations: { es: 'mundo' },
        },
      ],
      'es',
    )
    // Don't use String.trim() — it would strip the trailing tab on row 2.
    const lines = out.replace(/\n$/, '').split('\n')
    expect(lines).toEqual(['hello\thola\tcasual', 'world\tmundo\t'])
  })

  it('skips entries that have no translation in the chosen language', () => {
    const out = exportTSV(
      [
        { id: 'a', term: 'hello', definition: '', translations: { fr: 'bonjour' } },
      ],
      'es',
    )
    expect(out).toBe('')
  })

  it('flattens tabs and newlines in cells', () => {
    const out = exportTSV(
      [
        {
          id: 'a',
          term: 'multi\tword',
          definition: '',
          translations: { es: 'palabra\nrara' },
          notes: 'with\ttab',
        },
      ],
      'es',
    )
    expect(out).toBe('multi word\tpalabra rara\twith tab\n')
  })
})
