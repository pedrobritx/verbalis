import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { embeddingsRepo } from '@/storage/repositories/embeddingsRepo'
import { findSemanticMatches, mergeMatches } from '@/core/tm/semantic'
import type { TMEntry, TMMatch } from '@/core/types'

function entry(over: Partial<TMEntry>): TMEntry {
  return {
    id: crypto.randomUUID(),
    source: 'src',
    target: 'tgt',
    sourceLang: 'en',
    targetLang: 'es',
    date: new Date().toISOString(),
    ...over,
  }
}

beforeEach(async () => {
  await db.embeddings.clear()
})

const MODEL = 'test-model'

describe('findSemanticMatches', () => {
  it('returns empty when query is blank', async () => {
    const out = await findSemanticMatches(
      '  ',
      MODEL,
      [entry({})],
      { topK: 5, threshold: 0.5 },
      {
        embedAndRank: async () => [],
      },
    )
    expect(out).toEqual([])
  })

  it('returns empty when no candidates have embeddings', async () => {
    const candidates = [entry({ source: 'foo' }), entry({ source: 'bar' })]
    const out = await findSemanticMatches(
      'q',
      MODEL,
      candidates,
      { topK: 5, threshold: 0.5 },
      {
        embedAndRank: async () => {
          throw new Error('should not be called')
        },
      },
    )
    expect(out).toEqual([])
  })

  it('maps ranker results back to TMMatches with similarityMethod=semantic', async () => {
    const a = entry({ source: 'good morning' })
    const b = entry({ source: 'good night' })
    await embeddingsRepo.bulkUpsert([
      {
        id: 'e1',
        tmId: a.id,
        model: MODEL,
        dim: 2,
        vector: new Float32Array([1, 0]),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'e2',
        tmId: b.id,
        model: MODEL,
        dim: 2,
        vector: new Float32Array([0, 1]),
        createdAt: new Date().toISOString(),
      },
    ])
    const out = await findSemanticMatches(
      'greetings',
      MODEL,
      [a, b],
      { topK: 1, threshold: 0.5 },
      {
        embedAndRank: async (_q, _m, candidates, topK, threshold) => {
          expect(candidates).toHaveLength(2)
          return candidates
            .map((c) => ({ tmId: c.tmId, score: c.tmId === a.id ? 0.9 : 0.4 }))
            .filter((r) => r.score >= threshold)
            .slice(0, topK)
        },
      },
    )
    expect(out).toHaveLength(1)
    expect(out[0].entry.id).toBe(a.id)
    expect(out[0].similarityMethod).toBe('semantic')
    expect(out[0].score).toBeCloseTo(0.9)
  })
})

describe('mergeMatches', () => {
  function tm(id: string): TMEntry {
    return entry({ id })
  }

  it('combines and sorts by score descending', () => {
    const lex: TMMatch[] = [
      { entry: tm('a'), score: 0.8, isExact: false },
      { entry: tm('b'), score: 0.71, isExact: false },
    ]
    const sem: TMMatch[] = [
      { entry: tm('c'), score: 0.85, isExact: false, similarityMethod: 'semantic' },
    ]
    const out = mergeMatches(lex, sem, 5)
    expect(out.map((m) => m.entry.id)).toEqual(['c', 'a', 'b'])
  })

  it('lexical wins on tie', () => {
    const e = tm('shared')
    const lex: TMMatch[] = [{ entry: e, score: 0.8, isExact: false, similarityMethod: 'lexical' }]
    const sem: TMMatch[] = [{ entry: e, score: 0.8, isExact: false, similarityMethod: 'semantic' }]
    const out = mergeMatches(lex, sem, 5)
    expect(out).toHaveLength(1)
    expect(out[0].similarityMethod).toBe('lexical')
  })

  it('higher score wins regardless of method', () => {
    const e = tm('shared')
    const lex: TMMatch[] = [{ entry: e, score: 0.7, isExact: false, similarityMethod: 'lexical' }]
    const sem: TMMatch[] = [{ entry: e, score: 0.9, isExact: false, similarityMethod: 'semantic' }]
    const out = mergeMatches(lex, sem, 5)
    expect(out).toHaveLength(1)
    expect(out[0].similarityMethod).toBe('semantic')
    expect(out[0].score).toBeCloseTo(0.9)
  })

  it('caps results at limit', () => {
    const lex: TMMatch[] = Array.from({ length: 10 }, (_, i) => ({
      entry: tm(`l${i}`),
      score: 1 - i * 0.05,
      isExact: false,
    }))
    expect(mergeMatches(lex, [], 3)).toHaveLength(3)
  })

  it('annotates un-tagged lexical matches', () => {
    const e = tm('only-lex')
    const lex: TMMatch[] = [{ entry: e, score: 0.8, isExact: false }]
    const out = mergeMatches(lex, [], 5)
    expect(out[0].similarityMethod).toBe('lexical')
  })
})
