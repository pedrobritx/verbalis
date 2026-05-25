import { describe, expect, it } from 'vitest'
import {
  baseLanguage,
  displayLanguage,
  LANGUAGE_OPTIONS,
} from '@/core/i18n/languages'

describe('LANGUAGE_OPTIONS', () => {
  it('includes regional variants for English and Portuguese', () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code)
    expect(codes).toEqual(expect.arrayContaining(['en-US', 'en-GB', 'pt-BR', 'pt-PT']))
  })

  it('each option has the right base language', () => {
    expect(LANGUAGE_OPTIONS.find((o) => o.code === 'pt-BR')?.base).toBe('pt')
    expect(LANGUAGE_OPTIONS.find((o) => o.code === 'en-GB')?.base).toBe('en')
    expect(LANGUAGE_OPTIONS.find((o) => o.code === 'zh-Hant')?.base).toBe('zh')
  })
})

describe('baseLanguage', () => {
  it('returns the base for known regional tags', () => {
    expect(baseLanguage('pt-BR')).toBe('pt')
    expect(baseLanguage('en-US')).toBe('en')
    expect(baseLanguage('zh-Hans')).toBe('zh')
  })

  it('passes through bare ISO 639-1 codes (legacy data)', () => {
    expect(baseLanguage('en')).toBe('en')
    expect(baseLanguage('pt')).toBe('pt')
  })

  it('lowercases and strips unknown regional tags safely', () => {
    expect(baseLanguage('FR-ca')).toBe('fr')
    expect(baseLanguage('XX-YY')).toBe('xx')
  })

  it('handles the empty string without throwing', () => {
    expect(baseLanguage('')).toBe('')
  })
})

describe('displayLanguage', () => {
  it('returns a human label for known tags', () => {
    expect(displayLanguage('pt-BR')).toBe('Portuguese (Brazil)')
    expect(displayLanguage('en-GB')).toBe('English (UK)')
  })

  it('falls back to the raw tag for unknown codes', () => {
    expect(displayLanguage('xx-YY')).toBe('xx-YY')
  })
})
