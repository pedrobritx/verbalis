import { describe, expect, it } from 'vitest'
import { groupByNormalizedSource, repeatedIndices } from '@/core/segments/repetition'
import { buildPattern, previewReplace } from '@/core/segments/findReplace'
import type { Segment, SegmentStatus } from '@/core/types'

function seg(index: number, source: string, target = '', status: SegmentStatus = 'translated'): Segment {
  return {
    id: `s${index}`,
    projectId: 'p1',
    index,
    source,
    target,
    status,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

describe('repetition helpers', () => {
  it('groups by normalized source', () => {
    const map = groupByNormalizedSource([seg(0, 'Hello'), seg(1, 'hello '), seg(2, 'Bye')])
    expect(map.get('hello')).toHaveLength(2)
    expect(map.get('bye')).toHaveLength(1)
  })

  it('marks 2nd+ occurrences as repetitions', () => {
    const repeats = repeatedIndices([seg(0, 'A'), seg(1, 'B'), seg(2, 'a'), seg(3, 'A')])
    expect([...repeats].sort()).toEqual([2, 3])
  })
})

describe('find & replace', () => {
  it('builds a literal pattern and replaces in targets', () => {
    const rows = previewReplace([seg(0, 'x', 'color and colorful')], { find: 'color' }, 'colour')
    expect(rows).toHaveLength(1)
    expect(rows[0].after).toBe('colour and colourful')
    expect(rows[0].count).toBe(2)
  })

  it('honors whole-word matching', () => {
    const rows = previewReplace([seg(0, 'x', 'color and colorful')], { find: 'color', wholeWord: true }, 'colour')
    expect(rows[0].after).toBe('colour and colorful')
    expect(rows[0].count).toBe(1)
  })

  it('is case-insensitive by default and case-sensitive on request', () => {
    expect(previewReplace([seg(0, 'x', 'Color color')], { find: 'color' }, 'X')[0].count).toBe(2)
    expect(
      previewReplace([seg(0, 'x', 'Color color')], { find: 'color', caseSensitive: true }, 'X')[0].count,
    ).toBe(1)
  })

  it('skips locked segments and unchanged targets', () => {
    const rows = previewReplace(
      [seg(0, 'x', 'color', 'locked'), seg(1, 'x', 'no match here')],
      { find: 'color' },
      'colour',
    )
    expect(rows).toEqual([])
  })

  it('supports regex mode', () => {
    const rows = previewReplace([seg(0, 'x', 'a1b2c3')], { find: '\\d', regex: true }, '#')
    expect(rows[0].after).toBe('a#b#c#')
  })

  it('returns null pattern for invalid regex', () => {
    expect(buildPattern({ find: '(', regex: true })).toBeNull()
  })
})
