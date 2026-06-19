import { describe, expect, it } from 'vitest'
import { canJoin, mergeStatus, splitSourceText } from '@/core/segments/operations'
import type { Segment } from '@/core/types'

function seg(overrides: Partial<Segment> = {}): Segment {
  const now = '2020-01-01T00:00:00.000Z'
  return {
    id: crypto.randomUUID(),
    projectId: 'p1',
    index: 0,
    source: 's',
    target: '',
    status: 'untranslated',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('mergeStatus', () => {
  it('takes the less complete of two statuses', () => {
    expect(mergeStatus('reviewed', 'untranslated')).toBe('untranslated')
    expect(mergeStatus('translated', 'reviewed')).toBe('translated')
    expect(mergeStatus('draft', 'translated')).toBe('draft')
    expect(mergeStatus('reviewed', 'reviewed')).toBe('reviewed')
  })
})

describe('canJoin', () => {
  it('allows joining within the same source block', () => {
    const a = seg({ sourceMeta: { kind: 'paragraph', blockIndex: 2, sentenceIndex: 0 } })
    const b = seg({ sourceMeta: { kind: 'paragraph', blockIndex: 2, sentenceIndex: 1 } })
    expect(canJoin(a, b)).toBe(true)
  })

  it('forbids joining across blocks', () => {
    const a = seg({ sourceMeta: { kind: 'heading', blockIndex: 1, sentenceIndex: 0 } })
    const b = seg({ sourceMeta: { kind: 'paragraph', blockIndex: 2, sentenceIndex: 0 } })
    expect(canJoin(a, b)).toBe(false)
  })

  it('allows joining when block metadata is absent (e.g. XLIFF)', () => {
    expect(canJoin(seg(), seg())).toBe(true)
  })
})

describe('splitSourceText', () => {
  it('splits at the offset and trims the boundary whitespace', () => {
    expect(splitSourceText('Hello world', 5)).toEqual({ left: 'Hello', right: 'world' })
    expect(splitSourceText('One. Two.', 4)).toEqual({ left: 'One.', right: 'Two.' })
  })

  it('returns null when either side would be empty', () => {
    expect(splitSourceText('abc', 0)).toBeNull()
    expect(splitSourceText('abc', 3)).toBeNull()
    expect(splitSourceText('a ', 1)).toBeNull() // right side is only whitespace
  })
})
