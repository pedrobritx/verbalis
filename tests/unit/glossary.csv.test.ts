import { describe, expect, it } from 'vitest'
import { exportCSV, mergeRows, parseCSV } from '@/core/glossary/csv'
import type { GlossaryEntry } from '@/core/types'

describe('parseCSV', () => {
  it('parses a basic file with header row', () => {
    const text = `term,definition,sourceLang,targetLang,translation,notes
hello,a greeting,en,es,hola,casual
world,planet,en,es,mundo,`
    const out = parseCSV(text)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      term: 'hello',
      definition: 'a greeting',
      sourceLang: 'en',
      targetLang: 'es',
      translation: 'hola',
      notes: 'casual',
    })
    expect(out[1].translation).toBe('mundo')
    expect(out[1].notes).toBeUndefined()
  })

  it('handles quoted values with embedded commas and quotes', () => {
    const text = `term,definition,sourceLang,targetLang,translation,notes
"comma, in field","says ""hi""",en,es,"hola, amigo",`
    const out = parseCSV(text)
    expect(out).toHaveLength(1)
    expect(out[0].term).toBe('comma, in field')
    expect(out[0].definition).toBe('says "hi"')
    expect(out[0].translation).toBe('hola, amigo')
  })

  it('handles CRLF line endings', () => {
    const text =
      'term,definition,sourceLang,targetLang,translation,notes\r\n' +
      'a,b,en,es,x,\r\n' +
      'c,d,en,es,y,\r\n'
    const out = parseCSV(text)
    expect(out).toHaveLength(2)
    expect(out[0].term).toBe('a')
    expect(out[1].term).toBe('c')
  })

  it('ignores empty rows', () => {
    const text = `term,definition,sourceLang,targetLang,translation,notes
hello,,en,es,hola,

world,,en,es,mundo,`
    const out = parseCSV(text)
    expect(out).toHaveLength(2)
  })

  it('throws when the term column is missing', () => {
    const text = `definition,translation
foo,bar`
    expect(() => parseCSV(text)).toThrow(/term/i)
  })

  it('tolerates missing optional columns', () => {
    const text = `term,translation
hello,hola`
    const out = parseCSV(text)
    expect(out).toHaveLength(1)
    expect(out[0].term).toBe('hello')
    expect(out[0].translation).toBe('hola')
    expect(out[0].definition).toBe('')
    expect(out[0].sourceLang).toBeUndefined()
  })
})

describe('mergeRows', () => {
  it('merges rows sharing the same term', () => {
    const rows = parseCSV(`term,definition,sourceLang,targetLang,translation,notes
hello,a greeting,en,es,hola,
hello,,en,fr,bonjour,
hello,,en,de,hallo,
`)
    const entries = mergeRows(rows)
    expect(entries).toHaveLength(1)
    expect(entries[0].translations).toEqual({
      es: 'hola',
      fr: 'bonjour',
      de: 'hallo',
    })
  })

  it('treats terms with different casing as the same entry', () => {
    const rows = parseCSV(`term,definition,sourceLang,targetLang,translation,notes
Hello,,en,es,hola,
hello,,en,fr,bonjour,
`)
    const entries = mergeRows(rows)
    expect(entries).toHaveLength(1)
  })

  it('keeps separate entries for distinct terms', () => {
    const rows = parseCSV(`term,definition,sourceLang,targetLang,translation,notes
one,,en,es,uno,
two,,en,es,dos,
`)
    const entries = mergeRows(rows)
    expect(entries).toHaveLength(2)
  })
})

describe('exportCSV', () => {
  function entry(over: Partial<GlossaryEntry> = {}): GlossaryEntry {
    return {
      id: 'id-1',
      term: 'hello',
      definition: 'a greeting',
      translations: { es: 'hola' },
      notes: 'note',
      ...over,
    }
  }

  it('writes one row per (entry, translation lang)', () => {
    const out = exportCSV([entry({ translations: { es: 'hola', fr: 'bonjour' } })], 'en')
    const lines = out.trim().split('\n')
    expect(lines[0]).toBe('term,definition,sourceLang,targetLang,translation,notes')
    expect(lines).toHaveLength(3)
  })

  it('writes a single row with empty translation when the entry has none', () => {
    const out = exportCSV([entry({ translations: {} })], 'en')
    const lines = out.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1].startsWith('hello,')).toBe(true)
  })

  it('quotes values containing commas, newlines, and quotes', () => {
    const out = exportCSV([entry({ term: 'with, comma', definition: 'has "quotes"' })], 'en')
    expect(out).toContain('"with, comma"')
    expect(out).toContain('"has ""quotes"""')
  })

  it('round-trips through parse + merge', () => {
    const original: GlossaryEntry[] = [
      {
        id: 'a',
        term: 'hello',
        definition: 'a greeting',
        translations: { es: 'hola', fr: 'bonjour' },
        notes: 'note',
      },
      {
        id: 'b',
        term: 'world',
        definition: 'planet',
        translations: { es: 'mundo' },
      },
    ]
    const csv = exportCSV(original, 'en')
    const rows = parseCSV(csv)
    const merged = mergeRows(rows)
    expect(merged).toHaveLength(2)
    const helloEntry = merged.find((e) => e.term === 'hello')
    expect(helloEntry?.translations).toEqual({ es: 'hola', fr: 'bonjour' })
  })
})
