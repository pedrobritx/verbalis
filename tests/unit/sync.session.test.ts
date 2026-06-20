import 'fake-indexeddb/auto'
import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { __resetBridgeForTest } from '@/storage/sync/bridge'
import { startSyncSession, type SyncSessionHandle } from '@/storage/sync/syncSession'
import { applyCreate, readSegment } from '@/storage/sync/segmentCrdt'
import type { SyncMessage, SyncMessageHandler, SyncTransport } from '@/storage/sync/transport/types'
import type { Segment } from '@/core/types'

/**
 * A loopback transport pair: each instance delivers to its partner only (never
 * to itself), like BroadcastChannel, but deterministic for tests.
 */
class PairTransport implements SyncTransport {
  handler: SyncMessageHandler | null = null
  partner: PairTransport | null = null
  started = false
  start() {
    this.started = true
  }
  send(msg: SyncMessage) {
    const peer = this.partner
    if (peer?.started) queueMicrotask(() => peer.handler?.(msg))
  }
  onMessage(h: SyncMessageHandler) {
    this.handler = h
  }
  destroy() {
    this.started = false
    this.handler = null
  }
}

const tick = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0))
}

function makeSeg(id: string, overrides: Partial<Segment> = {}): Segment {
  const now = new Date().toISOString()
  return {
    id,
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

let docA: Y.Doc
let docB: Y.Doc
let sessionA: SyncSessionHandle
let sessionB: SyncSessionHandle

beforeEach(async () => {
  await db.segments.clear()
  __resetBridgeForTest()
  docA = new Y.Doc()
  docB = new Y.Doc()
})

afterEach(() => {
  sessionA?.destroy()
  sessionB?.destroy()
})

describe('sync session over a transport (F3)', () => {
  it('converges initial state and propagates live edits both ways', async () => {
    const tA = new PairTransport()
    const tB = new PairTransport()
    tA.partner = tB
    tB.partner = tA

    // A starts with a segment already in its doc.
    applyCreate(docA, makeSeg('s1', { source: 'hello', target: 'olá' }))

    sessionA = startSyncSession({ projectId: 'p1', doc: docA, displayName: 'Ana', transport: tA })
    sessionB = startSyncSession({ projectId: 'p1', doc: docB, displayName: 'Bo', transport: tB })
    await tick()

    // B learned A's state on join.
    expect(readSegment(docB, 'p1', 's1')?.target).toBe('olá')

    // A live edit on B reaches A.
    applyCreate(docB, makeSeg('s2', { source: 'world', target: 'mundo' }))
    await tick()
    expect(readSegment(docA, 'p1', 's2')?.target).toBe('mundo')
  })

  it('exchanges presence and lists the other peer', async () => {
    const tA = new PairTransport()
    const tB = new PairTransport()
    tA.partner = tB
    tB.partner = tA

    sessionA = startSyncSession({ projectId: 'p1', doc: docA, displayName: 'Ana', transport: tA })
    sessionB = startSyncSession({ projectId: 'p1', doc: docB, displayName: 'Bo', transport: tB })
    sessionB.setActiveSegment('s5')
    await tick()

    const peersOfA = sessionA.getPeers()
    expect(peersOfA).toHaveLength(1)
    expect(peersOfA[0].displayName).toBe('Bo')
    expect(peersOfA[0].activeSegmentId).toBe('s5')
  })
})
