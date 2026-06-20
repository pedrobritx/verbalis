/**
 * The peer transport seam (Foundation F3).
 *
 * A {@link SyncTransport} is the only thing the sync session knows about the
 * network. It moves opaque {@link SyncMessage}s between peers; it does not know
 * about Yjs, Dexie or the UI. Two implementations plug in behind this interface:
 *
 *  - `BroadcastChannelTransport` — same-machine, cross-tab, zero-dependency.
 *    Works in any browser today and is directly e2e-testable.
 *  - `TauriLanTransport` — the desktop shell's mDNS-discovered LAN peers. It
 *    speaks the identical message shapes, so swapping transports needs no change
 *    above this line.
 *
 * Keeping the contract this small is what lets "all product logic stay in the
 * shared React app while the desktop shell stays thin (discovery + transport)".
 */

/** Stable id for a peer's session (one per open project per process). */
export type PeerId = string

/**
 * A message exchanged between peers. Yjs `update`/`state` payloads and the
 * `presence` blob are carried as raw bytes so the transport can encrypt them
 * (LAN) or structured-clone them (BroadcastChannel) without parsing.
 */
export type SyncMessage =
  /** Announce arrival so existing peers reply with their state + presence. */
  | { kind: 'hello'; from: PeerId }
  /** Leaving cleanly so peers can drop us from the roster immediately. */
  | { kind: 'bye'; from: PeerId }
  /** Ask peers for their full doc state (sent on join alongside `hello`). */
  | { kind: 'state-request'; from: PeerId }
  /** A full `Y.encodeStateAsUpdate` of the doc, for initial convergence. */
  | { kind: 'state'; from: PeerId; payload: Uint8Array }
  /** An incremental Yjs document update. */
  | { kind: 'update'; from: PeerId; payload: Uint8Array }
  /** A peer's presence snapshot (name / colour / active segment), JSON bytes. */
  | { kind: 'presence'; from: PeerId; payload: Uint8Array }

export type SyncMessageHandler = (msg: SyncMessage) => void

export interface SyncTransport {
  /** Begin sending/receiving. Idempotent. */
  start(): void
  /** Send a message to all peers. */
  send(msg: SyncMessage): void
  /** Register the handler for inbound messages (own messages are not echoed). */
  onMessage(handler: SyncMessageHandler): void
  /** Stop and release resources (channel/socket, listeners). */
  destroy(): void
}
