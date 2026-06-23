import { describe, expect, it } from 'vitest'
import { resolveSpellLang } from '@/core/spell/dictionaries'

describe('resolveSpellLang', () => {
  it('routes British English to its own dictionary, not American', () => {
    expect(resolveSpellLang('en-GB')).toBe('en-GB')
    expect(resolveSpellLang('en-gb')).toBe('en-GB')
  })

  it('routes American and bare English to the American dictionary', () => {
    expect(resolveSpellLang('en-US')).toBe('en')
    expect(resolveSpellLang('en')).toBe('en')
  })

  it('routes Brazilian and bare Portuguese to the Brazilian dictionary', () => {
    expect(resolveSpellLang('pt-BR')).toBe('pt')
    expect(resolveSpellLang('pt')).toBe('pt')
  })

  it('routes European Portuguese to its own dictionary', () => {
    expect(resolveSpellLang('pt-PT')).toBe('pt-PT')
  })

  it('falls back to the base language for unknown regions', () => {
    expect(resolveSpellLang('en-CA')).toBe('en')
    expect(resolveSpellLang('pt-AO')).toBe('pt')
  })

  it('returns null for unbundled languages and empty input', () => {
    expect(resolveSpellLang('fr')).toBeNull()
    expect(resolveSpellLang('de-DE')).toBeNull()
    expect(resolveSpellLang(undefined)).toBeNull()
    expect(resolveSpellLang('')).toBeNull()
  })
})
