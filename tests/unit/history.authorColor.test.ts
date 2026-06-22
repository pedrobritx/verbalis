import { describe, expect, it } from 'vitest'
import { colorForAuthor } from '@/core/history/authorColor'

describe('colorForAuthor', () => {
  it('is deterministic for a given name', () => {
    expect(colorForAuthor('Ana')).toBe(colorForAuthor('Ana'))
  })

  it('gives different authors different hues', () => {
    expect(colorForAuthor('Ana')).not.toBe(colorForAuthor('Bruno'))
  })

  it('returns an hsl colour for a real name', () => {
    expect(colorForAuthor('Ana')).toMatch(/^hsl\(\d{1,3} 65% 55%\)$/)
  })

  it('falls back to a muted token for empty / missing names', () => {
    expect(colorForAuthor(undefined)).toBe('var(--color-muted)')
    expect(colorForAuthor('   ')).toBe('var(--color-muted)')
  })
})
