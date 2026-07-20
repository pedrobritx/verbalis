import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import {
  OutboundUpdateBatcher,
  SupabaseRealtimeTransport,
  type BroadcastChannelLike,
} from '@/storage/sync/transport/supabaseRealtime'
import type { SyncMessage } from '@/storage/sync/transport/types'

/** Two linked in-memory channels: a send on one reaches only the other (self:false). */
function linkedPair() {
  let aHandler: ((m: { payload: unknown }) => void) | null = null
  let bHandler: ((m: { payload: unknown }) => void) | null = null
  let aUp = false
  let bUp = false
  const a: BroadcastChannelLike = {
    on: (_t, _f, h) => ((aHandler = h), a),
    subscribe: (cb) => ((aUp = true), cb?.('SUBSCRIBED'), a),
    send: ({ payload }) => (bUp ? bHandler?.({ payload }) : undefined),
    unsubscribe: () => (aUp = false),
  }
  const b: BroadcastChannelLike = {
    on: (_t, _f, h) => ((bHandler = h), b),
    subscribe: (cb) => ((bUp = true), cb?.('SUBSCRIBED'), b),
    send: ({ payload }) => (aUp ? aHandler?.({ payload }) : undefined),
    unsubscribe: () => (bUp = false),
  }
  return { a, b }
}

const tick = () => Promise.resolve()

describe('OutboundUpdateBatcher', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('merges a burst of updates into one flush after the debounce', () => {
    const flushed: { merged: Uint8Array; from: string }[] = []
    const batcher = new OutboundUpdateBatcher((merged, from) => flushed.push({ merged, from }), 300)

    // Two sequential edits on a doc yield two updates that must merge to both.
    const doc = new Y.Doc()
    const arr = doc.getArray<string>('x')
    let u1: Uint8Array | null = null
    let u2: Uint8Array | null = null
    doc.on('update', (u) => (u1 ? (u2 = u) : (u1 = u)))
    arr.push(['a'])
    arr.push(['b'])

    batcher.add(u1!, 'peer-1')
    batcher.add(u2!, 'peer-1')
    expect(flushed).toHaveLength(0)
    vi.advanceTimersByTime(300)

    expect(flushed).toHaveLength(1)
    expect(flushed[0].from).toBe('peer-1')
    const rebuilt = new Y.Doc()
    Y.applyUpdate(rebuilt, flushed[0].merged)
    expect(rebuilt.getArray('x').toArray()).toEqual(['a', 'b'])
  })

  it('does not fire after destroy', () => {
    const flushed: unknown[] = []
    const batcher = new OutboundUpdateBatcher((m) => flushed.push(m), 300)
    batcher.add(new Uint8Array([1]), 'p')
    batcher.destroy()
    vi.advanceTimersByTime(1000)
    expect(flushed).toHaveLength(0)
  })
})

describe('SupabaseRealtimeTransport', () => {
  it('delivers a large (multi-chunk) state message to the other peer only', async () => {
    const { a, b } = linkedPair()
    const A = new SupabaseRealtimeTransport('proj', { channelProvider: async () => a })
    const B = new SupabaseRealtimeTransport('proj', { channelProvider: async () => b })

    const gotA: SyncMessage[] = []
    const gotB: SyncMessage[] = []
    A.onMessage((m) => gotA.push(m))
    B.onMessage((m) => gotB.push(m))
    A.start()
    B.start()
    await tick()
    await tick()

    // 50 KB → base64 > 60 KB is chunked; here it still exercises the framing.
    const payload = new Uint8Array(50_000)
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 7) & 0xff
    A.send({ kind: 'state', from: 'A', payload })

    expect(gotB).toHaveLength(1)
    expect(gotB[0].kind).toBe('state')
    expect((gotB[0] as Extract<SyncMessage, { kind: 'state' }>).payload).toEqual(payload)
    // self:false — the sender never sees its own broadcast.
    expect(gotA).toHaveLength(0)

    A.destroy()
    B.destroy()
  })

  it('buffers sends made before the channel subscribes, then flushes them', async () => {
    const { a, b } = linkedPair()
    const A = new SupabaseRealtimeTransport('proj', { channelProvider: async () => a })
    const B = new SupabaseRealtimeTransport('proj', { channelProvider: async () => b })
    const gotB: SyncMessage[] = []
    B.onMessage((m) => gotB.push(m))
    B.start()
    await tick()

    // Send immediately after start(), before A's async connect resolves.
    A.start()
    A.send({ kind: 'hello', from: 'A' })
    await tick()
    await tick()

    expect(gotB).toEqual([{ kind: 'hello', from: 'A' }])
    A.destroy()
    B.destroy()
  })
})
