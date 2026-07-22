import { describe, expect, it } from 'vitest'
import { diffWords } from '@/core/history/diff'

describe('diffWords', () => {
  it('marks unchanged text as equal', () => {
    expect(diffWords('hello world', 'hello world')).toEqual([{ op: 'equal', text: 'hello world' }])
  })

  it('detects an added word', () => {
    const parts = diffWords('hello world', 'hello big world')
    expect(parts.filter((p) => p.op === 'add').map((p) => p.text.trim())).toEqual(['big'])
    // Reassembling the "after" side reproduces the new text.
    expect(
      parts
        .filter((p) => p.op !== 'remove')
        .map((p) => p.text)
        .join(''),
    ).toBe('hello big world')
  })

  it('detects a removed word', () => {
    const parts = diffWords('hello big world', 'hello world')
    expect(parts.filter((p) => p.op === 'remove').map((p) => p.text.trim())).toEqual(['big'])
    expect(
      parts
        .filter((p) => p.op !== 'add')
        .map((p) => p.text)
        .join(''),
    ).toBe('hello big world')
  })

  it('handles a full replacement and empty sides', () => {
    expect(diffWords('', 'novo')).toEqual([{ op: 'add', text: 'novo' }])
    expect(diffWords('velho', '')).toEqual([{ op: 'remove', text: 'velho' }])
  })

  it('merges adjacent runs of the same op', () => {
    const parts = diffWords('a b c', 'x y c')
    // "a b " removed, "x y " added, "c" equal — each as a single merged part.
    expect(parts).toHaveLength(3)
    expect(parts[2]).toEqual({ op: 'equal', text: 'c' })
  })
})
