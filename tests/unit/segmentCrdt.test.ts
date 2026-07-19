import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  getSegmentsMap,
  isSeeded,
  readAllSegments,
  readSegment,
  seedFromDexie,
} from '@/storage/sync/segmentCrdt'
import type { Segment } from '@/core/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    projectId: 'p1',
    index: 0,
    source: 'source',
    target: 'alvo',
    status: 'draft',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('segmentCrdt model', () => {
  it('round-trips a segment through the doc, target as readable string', () => {
    const doc = new Y.Doc()
    const seg = makeSeg({
      id: 's1',
      target: 'um dois três',
      targetRich: '{"root":{}}',
      locked: true,
      note: 'a note',
      sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 0 },
      bilingualMeta: { transUnitId: 'tu1', inlineTags: { '1': '<b/>' } },
    })
    applyCreate(doc, seg)

    const out = readSegment(doc, 'p1', 's1')
    expect(out).toEqual(seg)
    // target lives as a Y.Text but reads back as a plain string.
    const ymap = getSegmentsMap(doc).get('s1')!
    expect(ymap.get('target')).toBeInstanceOf(Y.Text)
    expect((ymap.get('target') as Y.Text).toString()).toBe('um dois três')
  })

  it('round-trips comments as a Y.Array of Y.Map', () => {
    const doc = new Y.Doc()
    const seg = makeSeg({
      id: 's1',
      comments: [
        { id: 'c1', body: 'first', author: 'Ana', createdAt: 'x' },
        { id: 'c2', body: 'second', createdAt: 'y', resolved: true },
      ],
    })
    applyCreate(doc, seg)
    expect(readSegment(doc, 'p1', 's1')?.comments).toEqual(seg.comments)
  })

  it('round-trips anchored + threaded comment fields (parentId, anchorId, quote)', () => {
    const doc = new Y.Doc()
    const seg = makeSeg({
      id: 's1',
      comments: [
        { id: 'r1', body: 'root', createdAt: 'x', anchorId: 'a1', quote: 'hello world' },
        { id: 'x1', body: 'reply', createdAt: 'y', parentId: 'r1' },
      ],
    })
    applyCreate(doc, seg)
    expect(readSegment(doc, 'p1', 's1')?.comments).toEqual(seg.comments)
  })

  it('patches only changed fields on update and clears undefined ones', () => {
    const doc = new Y.Doc()
    applyCreate(doc, makeSeg({ id: 's1', target: 'antigo', targetRich: '{}', locked: true }))

    applyUpdate(
      doc,
      makeSeg({ id: 's1', target: 'novo', status: 'translated', targetRich: undefined, locked: undefined }),
    )

    const out = readSegment(doc, 'p1', 's1')!
    expect(out.target).toBe('novo')
    expect(out.status).toBe('translated')
    expect(out.targetRich).toBeUndefined()
    expect(out.locked).toBeUndefined()
  })

  it('reconciles comments on update (add, edit, remove)', () => {
    const doc = new Y.Doc()
    applyCreate(
      doc,
      makeSeg({
        id: 's1',
        comments: [
          { id: 'c1', body: 'one', createdAt: 'x' },
          { id: 'c2', body: 'two', createdAt: 'y' },
        ],
      }),
    )
    applyUpdate(
      doc,
      makeSeg({
        id: 's1',
        comments: [
          { id: 'c1', body: 'one edited', createdAt: 'x', resolved: true },
          { id: 'c3', body: 'three', createdAt: 'z' },
        ],
      }),
    )
    expect(readSegment(doc, 'p1', 's1')?.comments).toEqual([
      { id: 'c1', body: 'one edited', createdAt: 'x', resolved: true },
      { id: 'c3', body: 'three', createdAt: 'z' },
    ])
  })

  it('applyDelete removes the segment', () => {
    const doc = new Y.Doc()
    applyCreate(doc, makeSeg({ id: 's1' }))
    applyDelete(doc, 's1')
    expect(readSegment(doc, 'p1', 's1')).toBeNull()
  })

  it('seedFromDexie populates an empty doc once and marks it seeded', () => {
    const doc = new Y.Doc()
    expect(isSeeded(doc)).toBe(false)
    const segs = [makeSeg({ id: 'a', index: 2 }), makeSeg({ id: 'b', index: 0 }), makeSeg({ id: 'c', index: 1 })]
    seedFromDexie(doc, 'p1', segs)
    expect(isSeeded(doc)).toBe(true)
    expect(readAllSegments(doc, 'p1').map((s) => s.id)).toEqual(['b', 'c', 'a'])

    // Idempotent: re-seeding does not duplicate or clobber.
    seedFromDexie(doc, 'p1', segs)
    expect(getSegmentsMap(doc).size).toBe(3)
  })
})
