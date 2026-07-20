import type { PeerId } from './transport/types'

/**
 * Lightweight peer presence for LAN collaboration (Foundation F3).
 *
 * Presence answers "who else is in this project and which segment are they on".
 * It is deliberately *not* a CRDT: a peer simply broadcasts its current state on
 * a heartbeat, and stale peers expire. That avoids pulling in `y-protocols` for
 * what is ephemeral, best-effort UI data — the merge-critical document state is
 * the only thing that needs the CRDT.
 */

/** A peer's caret / selection within its active segment, as plain-text offsets. */
export interface CaretRange {
  /** Selection anchor offset in the segment's plain target text. */
  anchor: number
  /** Selection focus (caret) offset; equals `anchor` for a collapsed caret. */
  focus: number
}

export interface PeerPresence {
  peerId: PeerId
  displayName: string
  /** Deterministic accent colour derived from the peer id. */
  color: string
  /**
   * Stable cross-session identity (Supabase user id, or the local author id),
   * so attribution survives a peer reconnecting under a fresh peerId (D8).
   */
  userId?: string
  /** The segment the peer is currently focused on, if any. */
  activeSegmentId?: string
  /** The peer's caret / selection within {@link activeSegmentId}. */
  caret?: CaretRange
  /** Epoch ms of the last presence we heard (or sent, for self). */
  lastSeen: number
  /** True for the local peer's own entry. */
  self?: boolean
}

/** The over-the-wire presence shape (without the locally-derived fields). */
export interface PresenceWire {
  peerId: PeerId
  displayName: string
  userId?: string
  activeSegmentId?: string
  caret?: CaretRange
}

/** Peers unheard-from for this long are considered gone. */
export const PRESENCE_TTL_MS = 15_000
/** How often a peer re-announces its presence. */
export const PRESENCE_HEARTBEAT_MS = 5_000

const PEER_COLORS = [
  '#e0563f',
  '#3f8fe0',
  '#2fa86a',
  '#c9952b',
  '#9b59c9',
  '#1fa8a0',
  '#d8527a',
  '#6a7bd8',
]

/** Stable, well-distributed colour for a peer id (FNV-1a over the bytes). */
export function colorForPeer(peerId: PeerId): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < peerId.length; i += 1) {
    hash ^= peerId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return PEER_COLORS[(hash >>> 0) % PEER_COLORS.length]
}

/**
 * Tracks the roster of remote peers, expiring stale entries. Pure and
 * dependency-free so it is trivially unit-testable; the session feeds it wire
 * messages and a clock.
 */
export class PresenceTracker {
  private peers = new Map<PeerId, PeerPresence>()

  constructor(private readonly selfId: PeerId) {}

  /** Record/refresh a remote peer from a presence broadcast. */
  upsert(wire: PresenceWire, now: number = Date.now()): void {
    if (wire.peerId === this.selfId) return
    this.peers.set(wire.peerId, {
      peerId: wire.peerId,
      displayName: wire.displayName,
      color: colorForPeer(wire.peerId),
      userId: wire.userId,
      activeSegmentId: wire.activeSegmentId,
      caret: wire.caret,
      lastSeen: now,
    })
  }

  /** Drop a peer that announced its departure. */
  remove(peerId: PeerId): void {
    this.peers.delete(peerId)
  }

  /** Evict peers not heard from within {@link PRESENCE_TTL_MS}. */
  prune(now: number = Date.now()): void {
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > PRESENCE_TTL_MS) this.peers.delete(id)
    }
  }

  /** Current remote peers, oldest-seen first for a stable list order. */
  list(now: number = Date.now()): PeerPresence[] {
    this.prune(now)
    return [...this.peers.values()].sort((a, b) => a.peerId.localeCompare(b.peerId))
  }
}
