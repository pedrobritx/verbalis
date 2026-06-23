import { describe, expect, it } from 'vitest'
import { rankTranslations, splitSenses } from '@/core/glossary/rank'
import type { GlossaryEntry } from '@/core/types'

function entry(partial: Partial<GlossaryEntry>): GlossaryEntry {
  return {
    id: 'g1',
    term: 'bank',
    definition: '',
    translations: {},
    ...partial,
  }
}

describe('splitSenses', () => {
  it('splits on semicolons, slashes, pipes and comma-space', () => {
    expect(splitSenses('banco; orilla')).toEqual(['banco', 'orilla'])
    expect(splitSenses('claim, demand')).toEqual(['claim', 'demand'])
    expect(splitSenses('a / b | c')).toEqual(['a', 'b', 'c'])
  })

  it('keeps a single multi-word sense intact', () => {
    expect(splitSenses('court of appeal')).toEqual(['court of appeal'])
  })

  it('returns empty for blank input', () => {
    expect(splitSenses('   ')).toEqual([])
  })
})

describe('rankTranslations', () => {
  it('explodes a multi-sense value into separate, ordered candidates', () => {
    const candidates = rankTranslations(entry({ translations: { es: 'banco; orilla' } }), {
      targetLang: 'es',
    })
    expect(candidates.map((c) => c.value)).toEqual(['banco', 'orilla'])
    // The first sense ranks above the second.
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score)
  })

  it('prefers the exact target language, then the base language, then others', () => {
    const candidates = rankTranslations(
      entry({ translations: { 'pt-BR': 'banco', pt: 'margem', fr: 'banque' } }),
      { targetLang: 'pt-BR' },
    )
    expect(candidates[0].value).toBe('banco')
    expect(candidates[0].reasons).toContain('target language')
    // French (unrelated language) ranks last.
    expect(candidates[candidates.length - 1].value).toBe('banque')
  })

  it('matches the base language when the target is a regional variant', () => {
    const candidates = rankTranslations(entry({ translations: { pt: 'banco', en: 'bank' } }), {
      targetLang: 'pt-BR',
    })
    expect(candidates[0].value).toBe('banco')
  })

  it('flags context overlap between the gloss and the segment', () => {
    const e = entry({
      translations: { es: 'orilla' },
      definition: 'the land alongside a river',
    })
    const candidates = rankTranslations(e, {
      targetLang: 'es',
      segment: 'they walked along the river bank',
    })
    expect(candidates[0].reasons).toContain('context')
  })

  it('de-duplicates identical sense values', () => {
    const candidates = rankTranslations(entry({ translations: { es: 'banco; banco' } }), {
      targetLang: 'es',
    })
    expect(candidates).toHaveLength(1)
  })
})
