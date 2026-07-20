import { describe, expect, it } from 'vitest'
import { segmentLease, peersOnSegment } from '@/storage/sync/lease'
import { colorForPeer, type PeerPresence } from '@/storage/sync/presence'

/** A remote peer on a given segment (colour/lastSeen filled like the tracker). */
function peer(peerId: string, activeSegmentId?: string): PeerPresence {
  return { peerId, displayName: peerId, color: colorForPeer(peerId), activeSegmentId, lastSeen: 0 }
}

describe('segmentLease (deterministic lowest-peerId tie-break, D4)', () => {
  it('grants the lease when the local peer is alone on the segment', () => {
    expect(segmentLease('s1', 'b', 's1', [peer('a', 's2')])).toEqual({ owned: true })
  })

  it('grants the lease when the only co-editor has a higher peerId', () => {
    // self 'a' < remote 'z' → self owns.
    expect(segmentLease('s1', 'a', 's1', [peer('z', 's1')])).toEqual({ owned: true })
  })

  it('blocks the local peer when a lower-peerId peer co-edits, naming the holder', () => {
    const holder = peer('a', 's1')
    const view = segmentLease('s1', 'b', 's1', [holder, peer('c', 's1')])
    expect(view.owned).toBe(false)
    expect(view.heldBy?.peerId).toBe('a') // lowest of the lower-peerId contenders
  })

  it('reports the remote editor when the local peer is not on the segment', () => {
    const view = segmentLease('s1', 'z', 's9', [peer('m', 's1'), peer('h', 's1')])
    expect(view.owned).toBe(false)
    expect(view.heldBy?.peerId).toBe('h') // lowest peerId editing s1
  })

  it('is symmetric: two peers entering the same segment agree on one owner', () => {
    const a = segmentLease('s1', 'a', 's1', [peer('b', 's1')])
    const b = segmentLease('s1', 'b', 's1', [peer('a', 's1')])
    expect(a.owned).toBe(true)
    expect(b.owned).toBe(false)
    expect(b.heldBy?.peerId).toBe('a')
  })

  it('releases: with no peers left on the segment the local peer owns it', () => {
    expect(segmentLease('s1', 'b', 's1', [peer('a', 's2')]).owned).toBe(true)
  })
})

describe('peersOnSegment', () => {
  it('returns only peers focused on the segment', () => {
    const peers = [peer('a', 's1'), peer('b', 's2'), peer('c', 's1')]
    expect(peersOnSegment(peers, 's1').map((p) => p.peerId)).toEqual(['a', 'c'])
    expect(peersOnSegment(peers, 's3')).toEqual([])
  })
})
