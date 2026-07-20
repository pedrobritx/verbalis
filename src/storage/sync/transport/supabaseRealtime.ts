import * as Y from 'yjs'
import type { PeerId, SyncMessage, SyncMessageHandler, SyncTransport } from './types'
import { ChunkReassembler, encodeMessage, type WireChunk, CHUNK_LIMIT } from './chunking'
import { getSupabase } from '@/storage/cloud/supabaseClient'

/**
 * Live collaboration transport over Supabase Realtime broadcast (ROADMAP §4.2,
 * D6). Every member of a cloud project joins the private channel
 * `project:{cloudId}` and exchanges {@link SyncMessage}s framed as base64
 * {@link WireChunk}s (Realtime is JSON + ~250 KB/message, so payloads are
 * chunked). Outbound `update`s are debounce-merged with `Y.mergeUpdates` so a
 * burst of keystrokes becomes one broadcast. Implements {@link SyncTransport}
 * unchanged, so the sync session is transport-agnostic; the BroadcastChannel and
 * Tauri LAN transports are untouched.
 *
 * Strictly additive: the Supabase client loads lazily via `getSupabase()`, so
 * this file adds no `@supabase/supabase-js` to the initial graph.
 */

/** The slice of a Supabase `RealtimeChannel` this transport uses (also the test seam). */
export interface BroadcastChannelLike {
  on(
    type: 'broadcast',
    filter: { event: string },
    cb: (msg: { payload: unknown }) => void,
  ): BroadcastChannelLike
  subscribe(cb?: (status: string) => void): BroadcastChannelLike
  send(msg: { type: 'broadcast'; event: string; payload: unknown }): unknown
  unsubscribe(): unknown
}

const EVENT = 'sync'

/**
 * Accumulates outbound Yjs updates and flushes them merged, at most once per
 * `debounceMs`. Pure enough to unit-test with fake timers.
 */
export class OutboundUpdateBatcher {
  private buf: Uint8Array[] = []
  private from: PeerId = ''
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly flush: (merged: Uint8Array, from: PeerId) => void,
    private readonly debounceMs = 300,
  ) {}

  add(update: Uint8Array, from: PeerId): void {
    this.from = from
    this.buf.push(update)
    if (this.timer === null) {
      this.timer = setTimeout(() => this.run(), this.debounceMs)
    }
  }

  private run(): void {
    this.timer = null
    if (this.buf.length === 0) return
    const merged = this.buf.length === 1 ? this.buf[0] : Y.mergeUpdates(this.buf)
    this.buf = []
    this.flush(merged, this.from)
  }

  destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.buf = []
  }
}

type ChannelProvider = (channelName: string) => Promise<BroadcastChannelLike>

const defaultProvider: ChannelProvider = async (name) => {
  const supabase = await getSupabase()
  return supabase.channel(name, {
    config: { broadcast: { self: false } },
  }) as unknown as BroadcastChannelLike
}

export class SupabaseRealtimeTransport implements SyncTransport {
  private channel: BroadcastChannelLike | null = null
  private handler: SyncMessageHandler | null = null
  private readonly reassembler = new ChunkReassembler()
  private readonly batcher: OutboundUpdateBatcher
  private ready = false
  /** Frames buffered until the channel finishes subscribing. */
  private outbox: WireChunk[] = []
  private destroyed = false

  constructor(
    private readonly cloudId: string,
    opts: { debounceMs?: number; channelProvider?: ChannelProvider } = {},
  ) {
    this.batcher = new OutboundUpdateBatcher(
      (merged, from) => this.frameAndSend({ kind: 'update', from, payload: merged }),
      opts.debounceMs ?? 300,
    )
    this.provider = opts.channelProvider ?? defaultProvider
  }

  private readonly provider: ChannelProvider

  start(): void {
    if (this.channel || this.destroyed) return
    void this.connect()
  }

  private async connect(): Promise<void> {
    const channel = await this.provider(`project:${this.cloudId}`)
    if (this.destroyed) {
      channel.unsubscribe()
      return
    }
    channel.on('broadcast', { event: EVENT }, ({ payload }) =>
      this.onInbound(payload as WireChunk),
    )
    // Assign before subscribing: the SUBSCRIBED callback may fire synchronously
    // and flush the outbox, which sends through `this.channel`.
    this.channel = channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.ready = true
        for (const chunk of this.outbox) this.emit(chunk)
        this.outbox = []
      }
    })
  }

  send(msg: SyncMessage): void {
    if (this.destroyed) return
    // Coalesce bursts of incremental updates into one merged broadcast.
    if (msg.kind === 'update') {
      this.batcher.add(msg.payload, msg.from)
      return
    }
    this.frameAndSend(msg)
  }

  private frameAndSend(msg: SyncMessage): void {
    for (const chunk of encodeMessage(msg, CHUNK_LIMIT)) {
      if (this.ready) this.emit(chunk)
      else this.outbox.push(chunk)
    }
  }

  private emit(chunk: WireChunk): void {
    this.channel?.send({ type: 'broadcast', event: EVENT, payload: chunk })
  }

  private onInbound(chunk: WireChunk): void {
    const msg = this.reassembler.push(chunk)
    if (msg && this.handler) this.handler(msg)
  }

  onMessage(handler: SyncMessageHandler): void {
    this.handler = handler
  }

  destroy(): void {
    this.destroyed = true
    this.batcher.destroy()
    this.reassembler.reset()
    this.channel?.unsubscribe()
    this.channel = null
    this.handler = null
    this.outbox = []
    this.ready = false
  }
}
