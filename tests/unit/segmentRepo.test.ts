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

  it('addComment appends to an empty thread and refreshes updatedAt', async () => {
    const created = '2020-01-01T00:00:00.000Z'
    const seg = makeSeg({ createdAt: created, updatedAt: created })
    await segmentRepo.bulkCreate([seg])
    await segmentRepo.addComment(seg.id, {
      id: 'c1',
      body: 'Check this term',
      author: 'Pedro',
      createdAt: created,
    })
    const stored = await db.segments.get(seg.id)
    expect(stored?.comments).toHaveLength(1)
    expect(stored?.comments?.[0].body).toBe('Check this term')
    expect(stored?.updatedAt).not.toBe(created)
  })

  it('addComment preserves earlier comments', async () => {
    const seg = makeSeg()
    await segmentRepo.bulkCreate([seg])
    await segmentRepo.addComment(seg.id, { id: 'c1', body: 'first', createdAt: 'x' })
    await segmentRepo.addComment(seg.id, { id: 'c2', body: 'second', createdAt: 'y' })
    const stored = await db.segments.get(seg.id)
    expect(stored?.comments?.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('updateComment toggles resolve state on the right comment only', async () => {
    const seg = makeSeg({
      comments: [
        { id: 'c1', body: 'a', createdAt: 'x' },
        { id: 'c2', body: 'b', createdAt: 'y' },
      ],
    })
    await segmentRepo.bulkCreate([seg])
    await segmentRepo.updateComment(seg.id, 'c2', { resolved: true })
    const stored = await db.segments.get(seg.id)
    expect(stored?.comments?.find((c) => c.id === 'c1')?.resolved).toBeUndefined()
    expect(stored?.comments?.find((c) => c.id === 'c2')?.resolved).toBe(true)
  })

  it('deleteComment removes only the targeted comment', async () => {
    const seg = makeSeg({
      comments: [
        { id: 'c1', body: 'a', createdAt: 'x' },
        { id: 'c2', body: 'b', createdAt: 'y' },
      ],
    })
    await segmentRepo.bulkCreate([seg])
    await segmentRepo.deleteComment(seg.id, 'c1')
    const stored = await db.segments.get(seg.id)
    expect(stored?.comments?.map((c) => c.id)).toEqual(['c2'])
  })
})
