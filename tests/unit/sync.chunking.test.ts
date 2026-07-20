import { describe, expect, it } from 'vitest'
import {
  bytesToBase64,
  base64ToBytes,
  encodeMessage,
  ChunkReassembler,
} from '@/storage/sync/transport/chunking'
import type { SyncMessage } from '@/storage/sync/transport/types'

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) & 0xff
  return b
}

describe('base64 round-trip', () => {
  it('round-trips all byte values', () => {
    const bytes = randomBytes(256)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('handles an empty buffer', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('')
    expect(base64ToBytes('')).toEqual(new Uint8Array())
  })
})

describe('encodeMessage + ChunkReassembler', () => {
  it('single-chunk update round-trips through the reassembler', () => {
    const msg: SyncMessage = { kind: 'update', from: 'A', payload: randomBytes(64) }
    const chunks = encodeMessage(msg)
    expect(chunks).toHaveLength(1)
    const out = new ChunkReassembler().push(chunks[0])
    expect(out).toEqual(msg)
  })

  it('splits a large payload and reassembles it identically', () => {
    const payload = randomBytes(1000)
    const chunks = encodeMessage({ kind: 'state', from: 'B', payload }, 100)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.d.length <= 100)).toBe(true)
    expect(chunks.every((c) => c.n === chunks.length && c.k === 'state' && c.f === 'B')).toBe(true)

    const r = new ChunkReassembler()
    const results = chunks.map((c) => r.push(c))
    // Only the final chunk completes the message.
    expect(results.slice(0, -1).every((x) => x === null)).toBe(true)
    const done = results[results.length - 1]
    expect(done?.kind).toBe('state')
    expect((done as Extract<SyncMessage, { kind: 'state' }>).payload).toEqual(payload)
  })

  it('reassembles chunks that arrive out of order', () => {
    const payload = randomBytes(500)
    const chunks = encodeMessage({ kind: 'update', from: 'C', payload }, 60)
    const r = new ChunkReassembler()
    const shuffled = [...chunks].reverse()
    let done: SyncMessage | null = null
    for (const c of shuffled) done = r.push(c) ?? done
    expect((done as Extract<SyncMessage, { kind: 'update' }>).payload).toEqual(payload)
  })

  it('keeps two interleaved messages separate', () => {
    const p1 = randomBytes(300)
    const p2 = randomBytes(300)
    const a = encodeMessage({ kind: 'update', from: 'A', payload: p1 }, 80)
    const b = encodeMessage({ kind: 'update', from: 'B', payload: p2 }, 80)
    const r = new ChunkReassembler()
    const done: SyncMessage[] = []
    // Interleave a[0], b[0], a[1], b[1], …
    const max = Math.max(a.length, b.length)
    for (let i = 0; i < max; i++) {
      if (a[i]) { const m = r.push(a[i]); if (m) done.push(m) }
      if (b[i]) { const m = r.push(b[i]); if (m) done.push(m) }
    }
    expect(done).toHaveLength(2)
    const byPeer = Object.fromEntries(
      done.map((m) => [m.from, (m as Extract<SyncMessage, { kind: 'update' }>).payload]),
    )
    expect(byPeer.A).toEqual(p1)
    expect(byPeer.B).toEqual(p2)
  })

  it('passes payloadless kinds through without a payload field', () => {
    const chunks = encodeMessage({ kind: 'hello', from: 'A' })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].d).toBe('')
    expect(new ChunkReassembler().push(chunks[0])).toEqual({ kind: 'hello', from: 'A' })
  })
})
