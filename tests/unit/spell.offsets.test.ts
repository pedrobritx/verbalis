import { describe, expect, it } from 'vitest'
import { mapTokenToNode, mapOffsetToNode, type NodeSpan } from '@/core/spell/offsets'

// "Hello {1} wrld" → text "Hello " (0..6), tag "{1}" (6..9), text " wrld" (9..14)
const SPANS: NodeSpan[] = [
  { key: 't1', length: 6, isText: true },
  { key: 'g1', length: 3, isText: false },
  { key: 't2', length: 5, isText: true },
]

describe('mapTokenToNode', () => {
  it('maps a token inside the first text node', () => {
    // "Hello" = [0,5)
    expect(mapTokenToNode(SPANS, 0, 5)).toEqual({ key: 't1', localStart: 0, localEnd: 5 })
  })

  it('maps a token after a tag node to node-local offsets', () => {
    // " wrld" node spans plain [9,14); the word "wrld" = [10,14) → local [1,5)
    expect(mapTokenToNode(SPANS, 10, 14)).toEqual({ key: 't2', localStart: 1, localEnd: 5 })
  })

  it('returns null for a token that lands in a tag (non-text) node', () => {
    expect(mapTokenToNode(SPANS, 6, 9)).toBeNull()
  })

  it('returns null for a token that crosses a node boundary', () => {
    expect(mapTokenToNode(SPANS, 4, 8)).toBeNull()
  })

  it('returns null for an empty or inverted range', () => {
    expect(mapTokenToNode(SPANS, 5, 5)).toBeNull()
    expect(mapTokenToNode(SPANS, 5, 4)).toBeNull()
  })

  it('handles a single text span', () => {
    expect(mapTokenToNode([{ key: 'x', length: 10, isText: true }], 2, 6)).toEqual({
      key: 'x',
      localStart: 2,
      localEnd: 6,
    })
  })
})

describe('mapOffsetToNode (remote caret, §4.4.1)', () => {
  it('maps a caret inside the first text node', () => {
    expect(mapOffsetToNode(SPANS, 3)).toEqual({ key: 't1', localOffset: 3 })
  })

  it('resolves a boundary between two text spans to the end of the earlier one', () => {
    // Offset 6 is the end of t1 (and start of the tag) — snap to t1's end.
    expect(mapOffsetToNode(SPANS, 6)).toEqual({ key: 't1', localOffset: 6 })
  })

  it('maps a caret after a tag to the following text node', () => {
    // Offset 9 is the tag's end / t2's start.
    expect(mapOffsetToNode(SPANS, 9)).toEqual({ key: 't2', localOffset: 0 })
    // Offset 12 is inside t2 → local 3.
    expect(mapOffsetToNode(SPANS, 12)).toEqual({ key: 't2', localOffset: 3 })
  })

  it('maps the caret at the very end to the last text node', () => {
    expect(mapOffsetToNode(SPANS, 14)).toEqual({ key: 't2', localOffset: 5 })
  })

  it('returns null past the end or for a negative offset', () => {
    expect(mapOffsetToNode(SPANS, 15)).toBeNull()
    expect(mapOffsetToNode(SPANS, -1)).toBeNull()
  })
})
