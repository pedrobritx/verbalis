import type { PeerId, SyncMessage } from './types'

/**
 * Wire framing for the Supabase Realtime transport (ROADMAP §4.2). Realtime
 * broadcast carries JSON and caps a message at ~250 KB, so a {@link SyncMessage}
 * with binary payload is base64-encoded (+33%) and split into chunks under one
 * message id. Everything here is pure and unit-tested; the transport just glues
 * it to a channel.
 */

/** Max base64 chars per chunk. Well under Realtime's ~250 KB message ceiling. */
export const CHUNK_LIMIT = 60_000

/** One broadcast frame: a slice of one logical message's base64 payload. */
export interface WireChunk {
  /** Logical message id — groups the chunks of one SyncMessage. */
  id: string
  /** 0-based chunk index. */
  s: number
  /** Total number of chunks in this message. */
  n: number
  /** SyncMessage kind. */
  k: SyncMessage['kind']
  /** Sender peer id. */
  f: PeerId
  /** Base64 slice of the full payload (empty for payloadless kinds). */
  d: string
}

const PAYLOADLESS: ReadonlySet<SyncMessage['kind']> = new Set(['hello', 'bye', 'state-request'])

/** Encode arbitrary bytes as base64 (chunked to avoid arg-length limits). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(bin)
}

/** Decode a base64 string back to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

let counter = 0
function newMessageId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `m${Date.now().toString(36)}-${(counter++).toString(36)}`
}

/** Split a base64 string into `CHUNK_LIMIT`-sized slices (always ≥ 1 slice). */
function sliceBase64(b64: string, limit: number): string[] {
  if (b64.length <= limit) return [b64]
  const slices: string[] = []
  for (let i = 0; i < b64.length; i += limit) slices.push(b64.slice(i, i + limit))
  return slices
}

/** Frame a {@link SyncMessage} into one or more {@link WireChunk}s. */
export function encodeMessage(msg: SyncMessage, limit = CHUNK_LIMIT): WireChunk[] {
  const b64 = 'payload' in msg && msg.payload ? bytesToBase64(msg.payload) : ''
  const slices = sliceBase64(b64, limit)
  const id = newMessageId()
  return slices.map((d, s) => ({ id, s, n: slices.length, k: msg.kind, f: msg.from, d }))
}

/** Rebuild a {@link SyncMessage} from a completed set of ordered slices. */
function assemble(kind: SyncMessage['kind'], from: PeerId, b64: string): SyncMessage {
  if (PAYLOADLESS.has(kind)) return { kind, from } as SyncMessage
  return { kind, from, payload: base64ToBytes(b64) } as SyncMessage
}

/**
 * Collects inbound {@link WireChunk}s and yields a {@link SyncMessage} once all
 * chunks of a message have arrived (order-independent). Single-chunk messages
 * pass straight through. Partial messages are held until complete.
 */
export class ChunkReassembler {
  private pending = new Map<
    string,
    { n: number; kind: SyncMessage['kind']; from: PeerId; parts: Map<number, string> }
  >()

  /** Feed one chunk; returns the assembled message when this completes it. */
  push(chunk: WireChunk): SyncMessage | null {
    if (chunk.n <= 1) return assemble(chunk.k, chunk.f, chunk.d)

    let entry = this.pending.get(chunk.id)
    if (!entry) {
      entry = { n: chunk.n, kind: chunk.k, from: chunk.f, parts: new Map() }
      this.pending.set(chunk.id, entry)
    }
    entry.parts.set(chunk.s, chunk.d)
    if (entry.parts.size < entry.n) return null

    this.pending.delete(chunk.id)
    let b64 = ''
    for (let i = 0; i < entry.n; i++) b64 += entry.parts.get(i) ?? ''
    return assemble(entry.kind, entry.from, b64)
  }

  /** Drop any partially-received messages (on teardown). */
  reset(): void {
    this.pending.clear()
  }
}
