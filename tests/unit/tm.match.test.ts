import { describe, expect, it } from 'vitest'
import { findMatches } from '@/core/tm/match'
import type { TMEntry } from '@/core/types'

function entry(id: string, source: string, target = `target-${id}`): TMEntry {
  return {
    id,
    source,
    target,
    sourceLang: 'en',
    targetLang: 'es',
    date: '2024-01-01T00:00:00.000Z',
  }
}

describe('findMatches', () => {
  it('returns empty array for empty query', () => {
    expect(findMatches('', [entry('a', 'hello')], { threshold: 0.7, limit: 5 })).toEqual([])
  })

  it('returns empty array when no candidates clear the threshold', () => {
    const out = findMatches('hello world', [entry('a', 'completely different sentence')], {
      threshold: 0.7,
      limit: 5,
    })
    expect(out).toEqual([])
  })

  it('marks exact matches with score 1 and isExact: true', () => {
    const out = findMatches('Hello world', [entry('a', 'hello world')], {
      threshold: 0.7,
      limit: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].score).toBe(1)
    expect(out[0].isExact).toBe(true)
  })

  it('sorts results by score descending', () => {
    const candidates = [
      entry('a', 'hello worlds'),
      entry('b', 'hello world'),
      entry('c', 'hello world!'),
    ]
    const out = findMatches('hello world', candidates, { threshold: 0.7, limit: 5 })
    expect(out[0].entry.id).toBe('b')
    expect(out.map((m) => m.score)).toEqual([...out.map((m) => m.score)].sort((a, b) => b - a))
  })

  it('respects the limit', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => entry(`c${i}`, `hello world ${i}`))
    const out = findMatches('hello world', candidates, { threshold: 0.5, limit: 3 })
    expect(out).toHaveLength(3)
  })

  it('skips candidates that fail the length prefilter', () => {
    const out = findMatches(
      'short',
      [entry('a', 'a sentence considerably longer than the query')],
      { threshold: 0.7, limit: 5 },
    )
    expect(out).toEqual([])
  })

  it('handles empty source on a candidate without crashing', () => {
    const out = findMatches('hello', [entry('a', '')], { threshold: 0.7, limit: 5 })
    expect(out).toEqual([])
  })
})
