import type { PeerId } from './transport/types'
import type { PeerPresence } from './presence'

/**
 * Deterministic per-segment edit leases (ROADMAP §4.4, D4).
 *
 * Character-level same-segment rich co-editing is roadmap; until then a segment
 * is edited by one peer at a time, matching CAT-industry row-locking. When two
 * peers focus the same segment the tie is broken by the **lowest peerId**, so
 * every peer computes the same owner from the same presence roster with no
 * negotiation — pure and symmetric. The loser renders that segment read-only
 * with the owner's name chip; the lease is released the moment the owner blurs
 * (its `activeSegmentId` moves off the segment) and the next-lowest peer takes
 * over.
 */

export interface LeaseView {
  /** True when the local peer may edit the segment (holds the lease). */
  owned: boolean
  /** The remote peer holding the lease, when the local peer is blocked. */
  heldBy?: PeerPresence
}

/** The lowest-peerId peer in a list, or undefined when empty. */
function lowest(peers: PeerPresence[]): PeerPresence | undefined {
  return peers.reduce<PeerPresence | undefined>(
    (min, p) => (min === undefined || p.peerId < min.peerId ? p : min),
    undefined,
  )
}

/**
 * The local peer's lease for `segmentId`. The owner is the lowest peerId among
 * everyone editing the segment (the local peer, when `selfActiveSegmentId`
 * matches, plus any remote peers whose `activeSegmentId` matches).
 *
 * When the local peer is not on the segment, `owned` is false and `heldBy` names
 * the remote editor (if any) for a display indicator.
 */
export function segmentLease(
  segmentId: string,
  selfPeerId: PeerId,
  selfActiveSegmentId: string | undefined,
  peers: PeerPresence[],
): LeaseView {
  const remoteOnSeg = peers.filter((p) => p.activeSegmentId === segmentId)

  if (selfActiveSegmentId !== segmentId) {
    return { owned: false, heldBy: lowest(remoteOnSeg) }
  }

  // The local peer is contending; a remote peer wins only with a lower peerId.
  const lowerRemote = remoteOnSeg.filter((p) => p.peerId < selfPeerId)
  const holder = lowest(lowerRemote)
  return holder ? { owned: false, heldBy: holder } : { owned: true }
}

/** Remote peers currently focused on a segment (for caret / indicator overlays). */
export function peersOnSegment(peers: PeerPresence[], segmentId: string): PeerPresence[] {
  return peers.filter((p) => p.activeSegmentId === segmentId)
}
