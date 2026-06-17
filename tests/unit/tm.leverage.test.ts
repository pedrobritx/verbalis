import { describe, expect, it } from 'vitest'
import { pretranslate } from '@/core/tm/leverage'
import type { Segment, SegmentStatus, TMEntry } from '@/core/types'

function seg(id: string, source: string, status: SegmentStatus = 'untranslated'): Segment {
  return {
    id,
    projectId: 'p1',
    index: Number(id.replace(/\D/g, '')) || 0,
    source,
    target: '',
    status,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

function tm(source: string, target: string): TMEntry {
  return {
    id: `tm-${source}`,
    source,
    target,
    sourceLang: 'en',
    targetLang: 'es',
    date: '2024-01-01T00:00:00.000Z',
  }
}

describe('pretranslate', () => {
  const memory = [tm('Hello world', 'Hola mundo'), tm('Good morning', 'Buenos días')]

  it('returns an exact hit for an identical source', () => {
    const hits = pretranslate([seg('s0', 'Hello world')], memory, { minScore: 0.7 })
    expect(hits).toHaveLength(1)
    expect(hits[0].target).toBe('Hola mundo')
    expect(hits[0].isExact).toBe(true)
    expect(hits[0].score).toBe(1)
  })

  it('returns a fuzzy hit above threshold', () => {
    const hits = pretranslate([seg('s0', 'Hello worlds')], memory, { minScore: 0.7 })
    expect(hits).toHaveLength(1)
    expect(hits[0].isExact).toBe(false)
    expect(hits[0].score).toBeGreaterThan(0.7)
    expect(hits[0].score).toBeLessThan(1)
  })

  it('skips already-translated segments', () => {
    const hits = pretranslate([seg('s0', 'Hello world', 'translated')], memory, { minScore: 0.7 })
    expect(hits).toEqual([])
  })

  it('skips segments below the threshold', () => {
    const hits = pretranslate([seg('s0', 'totally unrelated phrase')], memory, { minScore: 0.7 })
    expect(hits).toEqual([])
  })

  it('returns nothing with an empty TM', () => {
    expect(pretranslate([seg('s0', 'Hello world')], [], { minScore: 0.7 })).toEqual([])
  })
})
