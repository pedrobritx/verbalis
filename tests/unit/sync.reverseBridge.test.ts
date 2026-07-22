import 'fake-indexeddb/auto'
import * as Y from 'yjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { db } from '@/storage/db'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { RICH_NAMESPACE, getRichNodes, richStateToPlain } from '@/core/editor/richText'
import { __resetBridgeForTest, installSegmentBridge, setDocResolver } from '@/storage/sync/bridge'
import { installReverseBridge } from '@/storage/sync/reverseBridge'
import { ORIGIN_REMOTE, getSegmentsMap, seedFromDexie } from '@/storage/sync/segmentCrdt'
import type { Segment } from '@/core/types'

/** A valid serialized Lexical target state whose plain derivation is `text`. */
function richFor(text: string): string {
  const editor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: () => {},
  })
  editor.update(
    () => {
      const p = $createParagraphNode()
      p.append($createTextNode(text))
      $getRoot().append(p)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

/** Flush pending microtasks + the reverse bridge's async Dexie writes. */
const tick = () => new Promise((r) => setTimeout(r, 0))

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

let local: Y.Doc

beforeAll(() => {
  installSegmentBridge()
})

beforeEach(async () => {
  await db.segments.clear()
  __resetBridgeForTest()
  local = new Y.Doc()
  // Forward bridge active and pointed at the same doc, so the test exercises the
  // real loop: remote update → reverse write to Dexie → (suppressed) forward hook.
  setDocResolver((projectId) => (projectId === 'p1' ? local : null))
})

describe('Yjs→Dexie reverse bridge (F3)', () => {
  it('reconciles a remote create into Dexie', async () => {
    const detach = installReverseBridge(local, 'p1')

    const remote = new Y.Doc()
    seedFromDexie(remote, 'p1', [
      makeSeg({ id: 's1', source: 'hello', target: 'olá', status: 'translated' }),
    ])
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), ORIGIN_REMOTE)
    await tick()

    const row = await segmentRepo.getById('s1')
    expect(row).toBeTruthy()
    expect(row?.source).toBe('hello')
    expect(row?.target).toBe('olá')
    expect(row?.status).toBe('translated')
    detach()
  })

  it('reconciles a remote target edit and a delete', async () => {
    const detach = installReverseBridge(local, 'p1')
    const remote = new Y.Doc()
    seedFromDexie(remote, 'p1', [makeSeg({ id: 's1', target: 'a' })])

    // Bring local + Dexie up to the seeded state.
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), ORIGIN_REMOTE)
    await tick()
    expect((await segmentRepo.getById('s1'))?.target).toBe('a')

    // Remote edits the target text → incremental update.
    const before = Y.encodeStateVector(local)
    const rseg = getSegmentsMap(remote).get('s1')!
    const rtext = rseg.get('target') as Y.Text
    remote.transact(() => {
      rtext.delete(0, rtext.length)
      rtext.insert(0, 'abc')
    })
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote, before), ORIGIN_REMOTE)
    await tick()
    expect((await segmentRepo.getById('s1'))?.target).toBe('abc')

    // Remote deletes the segment.
    const before2 = Y.encodeStateVector(local)
    remote.transact(() => getSegmentsMap(remote).delete('s1'))
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote, before2), ORIGIN_REMOTE)
    await tick()
    expect(await segmentRepo.getById('s1')).toBeUndefined()
    detach()
  })

  it('drops a stale targetRich when it no longer derives to the merged plain target (§4.4)', async () => {
    const detach = installReverseBridge(local, 'p1')
    const remote = new Y.Doc()
    // Seed a segment whose targetRich is consistent with its plain target.
    seedFromDexie(remote, 'p1', [makeSeg({ id: 's1', target: 'abc', targetRich: richFor('abc') })])
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), ORIGIN_REMOTE)
    await tick()
    // Guard is a no-op while they agree.
    expect((await segmentRepo.getById('s1'))?.targetRich).toBeTruthy()

    // A concurrent merge lands a new plain target on the char-level Y.Text but
    // leaves the (now-stale) targetRich scalar untouched — the mismatch case.
    const before = Y.encodeStateVector(local)
    const rtext = getSegmentsMap(remote).get('s1')!.get('target') as Y.Text
    remote.transact(() => {
      rtext.delete(0, rtext.length)
      rtext.insert(0, 'xyz')
    })
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote, before), ORIGIN_REMOTE)
    await tick()

    const row = await segmentRepo.getById('s1')
    expect(row?.target).toBe('xyz')
    // The stale rich was dropped so the editor rebuilds it from the plain truth.
    expect(row?.targetRich).toBeUndefined()
    expect(richStateToPlain(row?.targetRich)).toBe('')
    detach()
  })

  it('does not loop: the reverse write is mirror-suppressed', async () => {
    const detach = installReverseBridge(local, 'p1')
    const remote = new Y.Doc()
    seedFromDexie(remote, 'p1', [
      makeSeg({ id: 's1', target: 'x', updatedAt: '2020-01-01T00:00:00.000Z' }),
    ])
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), ORIGIN_REMOTE)
    await tick()

    // The reverse write stored the doc's own updatedAt verbatim (LWW), rather
    // than bumping it — proof the forward mirror did not re-fire on our write.
    expect((await segmentRepo.getById('s1'))?.updatedAt).toBe('2020-01-01T00:00:00.000Z')
    detach()
  })
})
