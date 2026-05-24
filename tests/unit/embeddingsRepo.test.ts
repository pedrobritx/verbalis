import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { embeddingsRepo } from '@/storage/repositories/embeddingsRepo'
import type { EmbeddingRecord } from '@/core/types'

function makeRecord(over: Partial<EmbeddingRecord> = {}): EmbeddingRecord {
  return {
    id: crypto.randomUUID(),
    tmId: crypto.randomUUID(),
    model: 'Xenova/test',
    dim: 4,
    vector: new Float32Array([0.1, 0.2, 0.3, 0.4]),
    createdAt: new Date().toISOString(),
    ...over,
  }
}

beforeEach(async () => {
  await db.embeddings.clear()
})

describe('embeddingsRepo', () => {
  it('round-trips Float32Array via Dexie', async () => {
    const rec = makeRecord()
    await embeddingsRepo.bulkUpsert([rec])
    const back = await embeddingsRepo.getByTmId(rec.tmId, rec.model)
    expect(back).toBeDefined()
    // fake-indexeddb's structuredClone polyfill can lose constructor identity
    // across realms (real browsers preserve it). Validate via shape + values.
    const view = back!.vector as unknown as ArrayLike<number>
    expect(view.length).toBe(4)
    const asArr = Array.from(view).map((n) => Math.fround(n))
    expect(asArr[0]).toBeCloseTo(0.1, 5)
    expect(asArr[3]).toBeCloseTo(0.4, 5)
  })

  it('byModel filters by model', async () => {
    await embeddingsRepo.bulkUpsert([
      makeRecord({ model: 'a' }),
      makeRecord({ model: 'b' }),
      makeRecord({ model: 'a' }),
    ])
    const a = await embeddingsRepo.byModel('a')
    expect(a).toHaveLength(2)
  })

  it('count counts by model', async () => {
    await embeddingsRepo.bulkUpsert([makeRecord({ model: 'a' }), makeRecord({ model: 'a' })])
    expect(await embeddingsRepo.count('a')).toBe(2)
    expect(await embeddingsRepo.count('b')).toBe(0)
  })

  it('deleteByModel removes only matching records', async () => {
    await embeddingsRepo.bulkUpsert([
      makeRecord({ model: 'a' }),
      makeRecord({ model: 'b' }),
    ])
    await embeddingsRepo.deleteByModel('a')
    expect(await embeddingsRepo.count('a')).toBe(0)
    expect(await embeddingsRepo.count('b')).toBe(1)
  })

  it('bulkUpsert updates existing by id', async () => {
    const rec = makeRecord()
    await embeddingsRepo.bulkUpsert([rec])
    const updated: EmbeddingRecord = {
      ...rec,
      vector: new Float32Array([1, 1, 1, 1]),
    }
    await embeddingsRepo.bulkUpsert([updated])
    const back = await embeddingsRepo.getByTmId(rec.tmId, rec.model)
    expect(Array.from(back!.vector)).toEqual([1, 1, 1, 1])
  })
})
