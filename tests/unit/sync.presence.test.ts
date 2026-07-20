import { describe, expect, it } from 'vitest'
import { PRESENCE_TTL_MS, PresenceTracker, colorForPeer } from '@/storage/sync/presence'

describe('presence tracker (F3)', () => {
  it('upserts remote peers and ignores self', () => {
    const t = new PresenceTracker('self')
    t.upsert({ peerId: 'self', displayName: 'Me' }, 1000)
    t.upsert({ peerId: 'a', displayName: 'Ana', activeSegmentId: 's3' }, 1000)
    const peers = t.list(1000)
    expect(peers).toHaveLength(1)
    expect(peers[0]).toMatchObject({ peerId: 'a', displayName: 'Ana', activeSegmentId: 's3' })
    expect(peers[0].color).toBe(colorForPeer('a'))
  })

  it('refreshes lastSeen on re-announce and reflects new active segment', () => {
    const t = new PresenceTracker('self')
    t.upsert({ peerId: 'a', displayName: 'Ana', activeSegmentId: 's1' }, 1000)
    t.upsert({ peerId: 'a', displayName: 'Ana', activeSegmentId: 's9' }, 2000)
    const [peer] = t.list(2000)
    expect(peer.activeSegmentId).toBe('s9')
    expect(peer.lastSeen).toBe(2000)
  })

  it('prunes peers past the TTL', () => {
    const t = new PresenceTracker('self')
    t.upsert({ peerId: 'a', displayName: 'Ana' }, 1000)
    expect(t.list(1000 + PRESENCE_TTL_MS - 1)).toHaveLength(1)
    expect(t.list(1000 + PRESENCE_TTL_MS + 1)).toHaveLength(0)
  })

  it('removes a peer on explicit departure', () => {
    const t = new PresenceTracker('self')
    t.upsert({ peerId: 'a', displayName: 'Ana' }, 1000)
    t.remove('a')
    expect(t.list(1000)).toHaveLength(0)
  })

  it('colorForPeer is deterministic and within the palette', () => {
    expect(colorForPeer('peer-x')).toBe(colorForPeer('peer-x'))
    expect(colorForPeer('peer-x')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('carries the stable userId and caret through upsert (§4.4)', () => {
    const t = new PresenceTracker('self')
    t.upsert(
      { peerId: 'a', displayName: 'Ana', userId: 'user-9', activeSegmentId: 's1', caret: { anchor: 2, focus: 5 } },
      1000,
    )
    const [peer] = t.list(1000)
    expect(peer.userId).toBe('user-9')
    expect(peer.caret).toEqual({ anchor: 2, focus: 5 })
  })
})
