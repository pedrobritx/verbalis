import { describe, expect, it } from 'vitest'
import { buildCorpusIndex, findCorpusHits, keySideForSourceLang } from '@/core/corpus/match'
import type { CorpusTerm } from '@/core/corpus/types'

function term(over: Partial<CorpusTerm> = {}): CorpusTerm {
  return {
    id: crypto.randomUUID(),
    corpusId: 'competition',
    source: 'acórdão',
    target: 'appellate decision',
    sourceLang: 'pt',
    targetLang: 'en',
    origin: 'CADE',
    ...over,
  }
}

describe('keySideForSourceLang', () => {
  it('matches the source side when the project source matches the term source', () => {
    expect(keySideForSourceLang('pt', 'pt')).toBe('source')
    expect(keySideForSourceLang('pt-BR', 'pt')).toBe('source')
  })
  it('matches the target side for the reverse direction', () => {
    expect(keySideForSourceLang('en', 'pt')).toBe('target')
    expect(keySideForSourceLang('en-GB', 'pt')).toBe('target')
  })
  it('defaults to source when unknown', () => {
    expect(keySideForSourceLang(undefined, 'pt')).toBe('source')
  })
})

describe('findCorpusHits (PT source side)', () => {
  const terms = [
    term({ source: 'acórdão', target: 'appellate decision' }),
    term({ source: 'recurso', target: 'appeal' }),
    term({ source: 'recurso especial', target: 'special appeal' }),
  ]
  const index = buildCorpusIndex(terms, 'source')

  it('finds a single-word term with diacritics, whole-word', () => {
    const hits = findCorpusHits('O acórdão foi publicado.', index, { limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0].suggestion).toBe('appellate decision')
    expect(hits[0].matchedSide).toBe('source')
  })

  it('prefers the longest multi-word term over its prefix', () => {
    const hits = findCorpusHits('Foi interposto recurso especial ontem.', index, { limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0].suggestion).toBe('special appeal')
  })

  it('does not match inside a larger word', () => {
    const hits = findCorpusHits('recursos diversos', index, { limit: 10 })
    // "recursos" must not match "recurso"
    expect(hits.find((h) => h.suggestion === 'appeal')).toBeUndefined()
  })

  it('returns hits sorted by position', () => {
    const hits = findCorpusHits('recurso e acórdão', index, { limit: 10 })
    expect(hits.map((h) => h.suggestion)).toEqual(['appeal', 'appellate decision'])
  })
})

describe('findCorpusHits (EN target side, reverse direction)', () => {
  const terms = [term({ source: 'leniência', target: 'leniency' })]
  const index = buildCorpusIndex(terms, 'target')

  it('matches the English side and suggests Portuguese', () => {
    const hits = findCorpusHits('The leniency programme applies.', index, { limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0].suggestion).toBe('leniência')
    expect(hits[0].matchedSide).toBe('target')
  })
})

describe('findCorpusHits limits', () => {
  it('respects the limit', () => {
    const terms = [
      term({ source: 'um', target: 'one' }),
      term({ source: 'dois', target: 'two' }),
      term({ source: 'três', target: 'three' }),
    ]
    const index = buildCorpusIndex(terms, 'source')
    const hits = findCorpusHits('um dois três', index, { limit: 2 })
    expect(hits).toHaveLength(2)
  })
})
