import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    projectId: 'p1',
    index: 0,
    source: 'src',
    target: '',
    status: 'untranslated',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.segments.clear()
})

describe('segmentRepo', () => {
  it('bulkCreate then byProject returns segments sorted by index', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ index: 2, source: 'c' }),
      makeSeg({ index: 0, source: 'a' }),
      makeSeg({ index: 1, source: 'b' }),
    ])
    const out = await segmentRepo.byProject('p1')
    expect(out.map((s) => s.source)).toEqual(['a', 'b', 'c'])
  })

  it('byProject ignores other projects', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ index: 0, projectId: 'p1' }),
      makeSeg({ index: 0, projectId: 'p2' }),
    ])
    const out = await segmentRepo.byProject('p1')
    expect(out).toHaveLength(1)
    expect(out[0].projectId).toBe('p1')
  })

  it('update mutates updatedAt and applies changes', async () => {
    const created = '2020-01-01T00:00:00.000Z'
    const seg = makeSeg({ createdAt: created, updatedAt: created })
    await segmentRepo.bulkCreate([seg])
    await segmentRepo.update(seg.id, { target: 'translated', status: 'translated' })
    const stored = await db.segments.get(seg.id)
    expect(stored?.target).toBe('translated')
    expect(stored?.status).toBe('translated')
    expect(stored?.updatedAt).not.toBe(created)
  })

  it('countByStatus tallies all statuses', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ index: 0, status: 'untranslated' }),
      makeSeg({ index: 1, status: 'untranslated' }),
      makeSeg({ index: 2, status: 'draft' }),
      makeSeg({ index: 3, status: 'translated' }),
    ])
    const counts = await segmentRepo.countByStatus('p1')
    expect(counts).toEqual({
      untranslated: 2,
      draft: 1,
      translated: 1,
      reviewed: 0,
      locked: 0,
    })
  })

  it('removeByProject clears only that project', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ index: 0, projectId: 'p1' }),
      makeSeg({ index: 1, projectId: 'p1' }),
      makeSeg({ index: 0, projectId: 'p2' }),
    ])
    await segmentRepo.removeByProject('p1')
    const left = await db.segments.toArray()
    expect(left).toHaveLength(1)
    expect(left[0].projectId).toBe('p2')
  })
})
