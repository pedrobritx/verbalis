import { describe, expect, it } from 'vitest'
import { levenshtein, normalize, similarityRatio } from '@/core/tm/similarity'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0)
  })

  it('returns length when one string is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('matches the classic kitten/sitting case', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })

  it('counts insertions, deletions, and substitutions', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1)
    expect(levenshtein('abcd', 'abc')).toBe(1)
    expect(levenshtein('abc', 'axc')).toBe(1)
  })

  it('is symmetric', () => {
    expect(levenshtein('hello world', 'world hello')).toBe(
      levenshtein('world hello', 'hello world'),
    )
  })
})

describe('similarityRatio', () => {
  it('is 1 for identical strings', () => {
    expect(similarityRatio('hello', 'hello')).toBe(1)
  })

  it('is 1 for two empty strings', () => {
    expect(similarityRatio('', '')).toBe(1)
  })

  it('is 0 for completely disjoint strings of equal length', () => {
    expect(similarityRatio('abc', 'xyz')).toBe(0)
  })

  it('falls between 0 and 1 for partial matches', () => {
    const r = similarityRatio('kitten', 'sitting')
    expect(r).toBeGreaterThan(0.5)
    expect(r).toBeLessThan(1)
  })
})

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('Hello')).toBe('hello')
  })

  it('collapses whitespace', () => {
    expect(normalize('  hello   world  ')).toBe('hello world')
  })

  it('NFC-normalizes', () => {
    const decomposed = 'café' // café with combining acute
    const composed = 'café'
    expect(normalize(decomposed)).toBe(normalize(composed))
  })
})
