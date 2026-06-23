import { describe, expect, it } from 'vitest'
import { mapTokenToNode, type NodeSpan } from '@/core/spell/offsets'

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
