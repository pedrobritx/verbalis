import { describe, expect, it } from 'vitest'
import { analyzeProject, bucketForScore } from '@/core/analysis/report'
import { countChars, countWords } from '@/core/analysis/wordcount'
import type { Segment, SegmentStatus, TMEntry } from '@/core/types'

function seg(index: number, source: string, status: SegmentStatus = 'untranslated'): Segment {
  return {
    id: `s${index}`,
    projectId: 'p1',
    index,
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

describe('countWords', () => {
  it('counts space-separated words', () => {
    expect(countWords('the quick brown fox')).toBe(4)
  })
  it('returns 0 for empty/blank', () => {
    expect(countWords('   ')).toBe(0)
  })
})

describe('countChars', () => {
  it('excludes whitespace by default', () => {
    expect(countChars('a b c')).toBe(3)
  })
  it('includes whitespace when asked', () => {
    expect(countChars('a b c', { includeWhitespace: true })).toBe(5)
  })
})

describe('bucketForScore', () => {
  it('maps score ranges to buckets', () => {
    expect(bucketForScore(1)).toBe('exact')
    expect(bucketForScore(0.97)).toBe('high')
    expect(bucketForScore(0.8)).toBe('medium')
    expect(bucketForScore(0.6)).toBe('low')
    expect(bucketForScore(0.1)).toBe('none')
  })
})

describe('analyzeProject', () => {
  const opts = { sourceLang: 'en', targetLang: 'es' }

  it('totals segments and words', () => {
    const report = analyzeProject([seg(0, 'one two'), seg(1, 'three')], [], opts)
    expect(report.totalSegments).toBe(2)
    expect(report.totalWords).toBe(3)
  })

  it('counts a repeated source as a repetition, not a fresh segment', () => {
    const report = analyzeProject([seg(0, 'Hello world'), seg(1, 'Hello world')], [], opts)
    expect(report.leverage.repetition.segments).toBe(1)
  })

  it('buckets an exact TM match as exact', () => {
    const report = analyzeProject([seg(0, 'Hello world')], [tm('Hello world', 'Hola mundo')], opts)
    expect(report.leverage.exact.segments).toBe(1)
  })

  it('buckets unmatched content as no-match', () => {
    const report = analyzeProject(
      [seg(0, 'unrelated text here')],
      [tm('Hello world', 'Hola')],
      opts,
    )
    expect(report.leverage.none.segments).toBe(1)
  })

  it('tracks status counts', () => {
    const report = analyzeProject(
      [seg(0, 'a', 'translated'), seg(1, 'b', 'untranslated')],
      [],
      opts,
    )
    expect(report.statusCounts.translated).toBe(1)
    expect(report.statusCounts.untranslated).toBe(1)
  })
})
