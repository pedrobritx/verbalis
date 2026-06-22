import { describe, expect, it } from 'vitest'
import { createChecker } from '@/core/spell/engine'

// A minimal Hunspell affix + dictionary. The first dic line is the word count.
const AFF = ['SET UTF-8', "TRY esianrtolcdugmphbyfvkwz'"].join('\n')
const DIC = ['4', 'hello', 'world', 'colour', 'translate'].join('\n')

describe('createChecker', () => {
  it('accepts known words and rejects unknown ones', () => {
    const c = createChecker(AFF, DIC)
    expect(c.correct('hello')).toBe(true)
    expect(c.correct('world')).toBe(true)
    expect(c.correct('helllo')).toBe(false)
  })

  it('suggests a close correction', () => {
    const c = createChecker(AFF, DIC)
    expect(c.suggest('helllo')).toContain('hello')
  })

  it('seeds personal words and accepts added ones', () => {
    const c = createChecker(AFF, DIC, ['verbalis'])
    expect(c.correct('verbalis')).toBe(true)
    expect(c.correct('memoq')).toBe(false)
    c.add('memoq')
    expect(c.correct('memoq')).toBe(true)
  })
})
