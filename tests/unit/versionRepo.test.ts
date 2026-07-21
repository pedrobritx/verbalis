import 'fake-indexeddb/auto'
import * as Y from 'yjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { versionRepo, AUTO_KEEP } from '@/storage/repositories/versionRepo'
import { installSegmentBridge, setDocResolver } from '@/storage/sync/bridge'
import type { ProjectVersion, Segment } from '@/core/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  await db.versions.clear()
  versionRepo.__resetThrottleForTest()
  doc = new Y.Doc()
  setDocResolver((projectId) => (projectId === 'p1' ? doc : null))
})

describe('versionRepo', () => {
  it('saveNamed → restoreProject round-trips to the captured state', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'original', status: 'translated' })])
    const v1 = await versionRepo.saveNamed('p1', 'baseline', doc)
    expect(v1).not.toBeNull()
    expect(v1!.kind).toBe('named')
    expect(v1!.label).toBe('baseline')
    expect(v1!.segmentCount).toBe(1)

    await segmentRepo.update('s1', { target: 'changed', status: 'reviewed' })
    expect((await segmentRepo.getById('s1'))?.target).toBe('changed')

    const ok = await versionRepo.restoreProject('p1', v1!.id)
    expect(ok).toBe(true)
    const restored = await segmentRepo.getById('s1')
    expect(restored?.target).toBe('original')
    expect(restored?.status).toBe('translated')
  })

  it('restoreProject re-adds deleted segments and drops added ones', async () => {
    await segmentRepo.bulkCreate([
      makeSeg({ id: 'a', index: 0, target: 'A' }),
      makeSeg({ id: 'b', index: 1, target: 'B' }),
    ])
    const v1 = await versionRepo.saveNamed('p1', 'two segments', doc)

    await db.segments.delete('a')
    await segmentRepo.bulkCreate([makeSeg({ id: 'c', index: 2, target: 'C' })])

    await versionRepo.restoreProject('p1', v1!.id)
    const ids = (await segmentRepo.byProject('p1')).map((s) => s.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('restoreSegment restores a single row and clears fields it lacked', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'v1text', status: 'draft' })])
    const v1 = await versionRepo.saveNamed('p1', 'before rich', doc)

    await segmentRepo.update('s1', { target: 'richtext', targetRich: '{"root":{}}', status: 'translated' })
    expect((await segmentRepo.getById('s1'))?.targetRich).toBeDefined()

    const ok = await versionRepo.restoreSegment('p1', 's1', v1!.id)
    expect(ok).toBe(true)
    const seg = await segmentRepo.getById('s1')
    expect(seg?.target).toBe('v1text')
    expect(seg?.status).toBe('draft')
    expect(seg?.targetRich).toBeUndefined()
  })

  it('stamps a stable authorId on every capture (unified attribution, §5.3)', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'x' })])
    const v1 = await versionRepo.saveNamed('p1', 'v1', doc)
    const v2 = await versionRepo.saveNamed('p1', 'v2', doc)
    expect(v1!.authorId).toBeTruthy()
    // Same local identity across captures (the id marks/comments/presence use).
    expect(v2!.authorId).toBe(v1!.authorId)
  })

  it('signOff records a labeled approval version stamped with the signer (§5.3)', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'x', status: 'translated' })])
    const v = await versionRepo.signOff('p1', doc)
    expect(v!.kind).toBe('named')
    expect(v!.label).toMatch(/Approved by/)
    expect(v!.approval).toBeTruthy()
    expect(v!.approval!.authorId).toBe(v!.authorId)
    expect(v!.approval!.at).toBe(v!.createdAt)

    // A plain named version carries no approval.
    const plain = await versionRepo.saveNamed('p1', 'plain', doc)
    expect(plain!.approval).toBeUndefined()
  })

  it('maybeAutoSnapshot throttles to one per window', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1' })])
    const first = await versionRepo.maybeAutoSnapshot('p1', doc)
    const second = await versionRepo.maybeAutoSnapshot('p1', doc)
    expect(first).not.toBeNull()
    expect(first!.kind).toBe('auto')
    expect(second).toBeNull()
  })

  it('pruneAuto keeps only the most recent AUTO_KEEP auto-snapshots', async () => {
    const base = Date.parse('2020-01-01T00:00:00.000Z')
    const rows: ProjectVersion[] = Array.from({ length: AUTO_KEEP + 5 }, (_, i) => ({
      id: `auto-${i}`,
      projectId: 'p1',
      kind: 'auto',
      snapshot: new Uint8Array(),
      segmentCount: 0,
      createdAt: new Date(base + i * 1000).toISOString(),
    }))
    await db.versions.bulkAdd(rows)
    await versionRepo.pruneAuto('p1')

    const remaining = await db.versions.where('projectId').equals('p1').toArray()
    expect(remaining).toHaveLength(AUTO_KEEP)
    // The 5 oldest were pruned.
    expect(remaining.map((v) => v.id)).not.toContain('auto-0')
    expect(remaining.map((v) => v.id)).toContain(`auto-${AUTO_KEEP + 4}`)
  })

  it('restoreProject reverts target and targetRich together (F1 invariant)', async () => {
    // Plain target whose rich form serializes to the same text keeps the F1
    // contract: restoring must revert both layers as a unit.
    const rich = JSON.stringify({
      root: {
        children: [
          {
            children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'rico', type: 'text', version: 1 }],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    })
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'rico', targetRich: rich })])
    const v1 = await versionRepo.saveNamed('p1', 'rich baseline', doc)

    await segmentRepo.update('s1', { target: 'plano', targetRich: undefined })
    await versionRepo.restoreProject('p1', v1!.id)

    const restored = await segmentRepo.getById('s1')
    expect(restored?.target).toBe('rico')
    expect(restored?.targetRich).toBe(rich)
  })

  it('segmentTimeline collapses unchanged states, newest first', async () => {
    await segmentRepo.bulkCreate([makeSeg({ id: 's1', target: 'one', status: 'draft' })])
    await versionRepo.saveNamed('p1', 'v1', doc)
    await sleep(3)
    // No change → should be collapsed away.
    await versionRepo.saveNamed('p1', 'v2', doc)
    await sleep(3)
    await segmentRepo.update('s1', { target: 'two', status: 'translated' })
    await versionRepo.saveNamed('p1', 'v3', doc)

    const timeline = await versionRepo.segmentTimeline('p1', 's1')
    expect(timeline.map((e) => e.target)).toEqual(['two', 'one'])
    expect(timeline[0].status).toBe('translated')
  })
})
