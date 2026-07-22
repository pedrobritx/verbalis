import 'fake-indexeddb/auto'
import * as Y from 'yjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { installSegmentBridge, setDocResolver } from '@/storage/sync/bridge'
import { readAllSegments, readSegment } from '@/storage/sync/segmentCrdt'
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

let doc: Y.Doc

beforeAll(() => {
  installSegmentBridge()
})

beforeEach(async () => {
  await db.segments.clear()
  doc = new Y.Doc()
  // Mirror only project p1; other projects resolve to null (no-op).
  setDocResolver((projectId) => (projectId === 'p1' ? doc : null))
})

describe('Dexie→Yjs bridge', () => {
  it('mirrors bulkCreate and update through hooks', async () => {
    const seg = makeSeg({ id: 's1', source: 'hello' })
    await segmentRepo.bulkCreate([seg])
    expect(readSegment(doc, 'p1', 's1')?.source).toBe('hello')

    await segmentRepo.update('s1', { target: 'olá', status: 'translated' })
    const out = readSegment(doc, 'p1', 's1')!
    expect(out.target).toBe('olá')
    expect(out.status).toBe('translated')
  })

  it('mirrors setLocked and comment ops', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1' })])
    await segmentRepo.setLocked('s1', true)
    expect(readSegment(doc, 'p1', 's1')?.locked).toBe(true)

    await segmentRepo.addComment('s1', { id: 'c1', body: 'hi', createdAt: 'x' })
    expect(readSegment(doc, 'p1', 's1')?.comments).toEqual([
      { id: 'c1', body: 'hi', createdAt: 'x' },
    ])

    await segmentRepo.deleteComment('s1', 'c1')
    expect(readSegment(doc, 'p1', 's1')?.comments).toBeUndefined()
  })

  it('mirrors splitSegment (bulkPut + creating) and joinWithNext (delete)', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ id: 'a', index: 0, source: 'one two three' }),
      makeSeg({ id: 'b', index: 1, source: 'tail' }),
    ])
    const newId = await segmentRepo.splitSegment('p1', 'a', 3)
    expect(newId).toBeTruthy()
    // doc now has 3 segments, indices contiguous.
    expect(readAllSegments(doc, 'p1').map((s) => s.index)).toEqual([0, 1, 2])

    await segmentRepo.joinWithNext('p1', 'a')
    const ids = readAllSegments(doc, 'p1').map((s) => s.id)
    expect(ids).toContain('a')
    expect(ids).not.toContain(newId)
  })

  it('is a no-op when the project has no open doc', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 'x1', projectId: 'p2' })])
    // p2 resolves to null, so nothing mirrors into p1's doc.
    expect(readSegment(doc, 'p1', 'x1')).toBeNull()
  })
})
