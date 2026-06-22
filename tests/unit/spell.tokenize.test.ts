import { describe, expect, it } from 'vitest'
import { tokenizeWords } from '@/core/spell/tokenize'

const words = (text: string) => tokenizeWords(text).map((t) => t.word)

describe('tokenizeWords', () => {
  it('returns words with correct offsets', () => {
    const tokens = tokenizeWords('the cat')
    expect(tokens).toEqual([
      { word: 'the', start: 0, end: 3 },
      { word: 'cat', start: 4, end: 7 },
    ])
  })

  it('keeps internal apostrophes and hyphens', () => {
    expect(words("don't e-mail")).toEqual(["don't", 'e-mail'])
  })

  it('strips trailing punctuation from a word', () => {
    const tokens = tokenizeWords('hello, world.')
    expect(tokens[0]).toEqual({ word: 'hello', start: 0, end: 5 })
    expect(words('hello, world.')).toEqual(['hello', 'world'])
  })

  it('skips chunks containing digits, urls and emails', () => {
    expect(words('see https://example.com or a@b.com for h2o 5th')).toEqual(['see', 'or', 'for'])
  })

  it('skips inline-tag placeholders', () => {
    expect(words('Art. {1} do CDC {2}')).toEqual(['Art', 'do'])
  })

  it('skips all-caps acronyms but keeps capitalized words', () => {
    expect(words('The NASA report')).toEqual(['The', 'report'])
  })

  it('offsets survive multi-space and accented text', () => {
    const tokens = tokenizeWords('boa-fé  objetiva')
    expect(tokens).toEqual([
      { word: 'boa-fé', start: 0, end: 6 },
      { word: 'objetiva', start: 8, end: 16 },
    ])
  })
})
