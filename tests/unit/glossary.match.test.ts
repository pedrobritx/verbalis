import { describe, expect, it } from 'vitest'
import { findGlossaryHits } from '@/core/glossary/match'
import type { GlossaryEntry } from '@/core/types'

function entry(over: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: over.id ?? crypto.randomUUID(),
    term: 'hello',
    definition: '',
    translations: { es: 'hola' },
    ...over,
  }
}

describe('findGlossaryHits', () => {
  it('matches a whole word case-insensitively', () => {
    const out = findGlossaryHits('Hello world!', [entry({ term: 'hello' })], { limit: 10 })
    expect(out).toHaveLength(1)
    expect(out[0].start).toBe(0)
    expect(out[0].end).toBe(5)
  })

  it('does not match a substring inside a longer word', () => {
    const out = findGlossaryHits('a smart move', [entry({ term: 'art' })], { limit: 10 })
    expect(out).toEqual([])
  })

  it('returns empty array for empty source', () => {
    expect(findGlossaryHits('', [entry()], { limit: 10 })).toEqual([])
    expect(findGlossaryHits('   ', [entry()], { limit: 10 })).toEqual([])
  })

  it('returns empty array when no entries match', () => {
    const out = findGlossaryHits('nothing here', [entry({ term: 'foo' })], { limit: 10 })
    expect(out).toEqual([])
  })

  it('skips terms shorter than the minimum length', () => {
    const out = findGlossaryHits('a quick fox', [entry({ term: 'a' })], { limit: 10 })
    expect(out).toEqual([])
  })

  it('handles unicode letters at word boundaries', () => {
    const out = findGlossaryHits('café au lait', [entry({ term: 'café' })], { limit: 10 })
    expect(out).toHaveLength(1)
    expect(out[0].entry.term).toBe('café')
  })

  it('does not double-report the same entry when it appears twice', () => {
    const out = findGlossaryHits('hello hello hello', [entry({ id: '1', term: 'hello' })], {
      limit: 10,
    })
    expect(out).toHaveLength(1)
  })

  it('respects the limit option', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => entry({ id: `e${i}`, term: `term${i}` }))
    const source = 'term0 term1 term2 term3 term4'
    const out = findGlossaryHits(source, candidates, { limit: 3 })
    expect(out).toHaveLength(3)
  })

  it('sorts hits by start offset', () => {
    const candidates = [
      entry({ id: 'second', term: 'second' }),
      entry({ id: 'first', term: 'first' }),
    ]
    const out = findGlossaryHits('first then second', candidates, { limit: 10 })
    expect(out.map((h) => h.entry.id)).toEqual(['first', 'second'])
  })

  it('matches multi-word terms', () => {
    const out = findGlossaryHits(
      'A machine learning model.',
      [entry({ term: 'machine learning' })],
      { limit: 10 },
    )
    expect(out).toHaveLength(1)
    expect(out[0].start).toBe(2)
  })

  it('handles term with regex metacharacters safely', () => {
    const out = findGlossaryHits('use C++ here', [entry({ term: 'C++' })], { limit: 10 })
    expect(out).toHaveLength(1)
  })
})
