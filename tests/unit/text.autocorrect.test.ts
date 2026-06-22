import { describe, expect, it } from 'vitest'
import { autocorrectOnInput, type AutocorrectRule } from '@/core/text/autocorrect'

const RULES: AutocorrectRule[] = [
  { from: 'eg', to: 'e.g.' },
  { from: 'teh', to: 'the' },
  { from: 'dont', to: "don't" },
]

/** Simulate typing `boundary` right after `word`: value/caret as the textarea sees it. */
function typeAfter(word: string, boundary = ' ') {
  const value = word + boundary
  return autocorrectOnInput(value, value.length, RULES)
}

describe('autocorrectOnInput', () => {
  it('expands a known token when a boundary is typed', () => {
    expect(typeAfter('eg')).toEqual({ value: 'e.g. ', caret: 5 })
  })

  it('preserves a leading capital', () => {
    expect(typeAfter('Teh')).toEqual({ value: 'The ', caret: 4 })
  })

  it('only expands the word immediately before the caret', () => {
    const value = 'I think eg '
    expect(autocorrectOnInput(value, value.length, RULES)).toEqual({
      value: 'I think e.g. ',
      caret: 13,
    })
  })

  it('works for any boundary character, not just space', () => {
    const value = 'eg,'
    expect(autocorrectOnInput(value, value.length, RULES)).toEqual({ value: 'e.g.,', caret: 5 })
  })

  it('does not fire mid-word (no boundary yet)', () => {
    expect(autocorrectOnInput('eg', 2, RULES)).toBeNull()
  })

  it('returns null for an unknown token', () => {
    expect(typeAfter('hello')).toBeNull()
  })

  it('does not expand when the caret is not after the boundary', () => {
    // caret in the middle of a longer string, not just after the typed boundary
    expect(autocorrectOnInput('eg foo', 6, RULES)).toBeNull()
  })

  it('handles a replacement containing the boundary-sensitive apostrophe', () => {
    expect(typeAfter('dont')).toEqual({ value: "don't ", caret: 6 })
  })
})
