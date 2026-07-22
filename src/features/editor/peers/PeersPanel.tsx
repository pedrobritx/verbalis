import { Users, Wifi } from 'lucide-react'
import { shareRepo } from '@/storage/repositories/shareRepo'
import { isTauri } from '@/storage/sync/platform'
import { usePresenceStore } from './usePresenceStore'
import { PEER_NAME_FALLBACK } from '@/features/account/displayName'

/**
 * The Peers sidebar tab (Foundation F3, Phase 14).
 *
 * memoQ's "share on server" becomes "share with peers on this network": a single
 * opt-in toggle, then a live roster of who else is in the project and which
 * segment they are on. Sharing is per-project and off by default — a project
 * stays private until the user turns this on.
 */
interface PeersPanelProps {
  projectId: string
}

export function PeersPanel({ projectId }: PeersPanelProps) {
  const shared = usePresenceStore((s) => s.shared)
  const peers = usePresenceStore((s) => s.peers)

  const toggleShare = async (next: boolean) => {
    const current = await shareRepo.get(projectId)
    await shareRepo.set(projectId, { ...current, shared: next })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="peers-panel">
      <label
        className="flex items-center justify-between gap-3 text-callout"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex items-center gap-2">
          <Wifi size={15} style={{ color: 'var(--color-accent)' }} />
          Share with peers on this network
        </span>
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => void toggleShare(e.target.checked)}
          data-testid="peers-share-toggle"
        />
      </label>

      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        {isTauri()
          ? 'Peers on your local network are discovered automatically. Edits merge live; nothing leaves your network.'
          : 'Live sync runs between open tabs on this device. Install the desktop app to discover and sync with other machines on your LAN.'}
      </p>

      {shared && (
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 text-footnote font-semibold"
            style={{ color: 'var(--color-muted)' }}
          >
            <Users size={14} />
            Peers ({peers.length})
          </div>
          {peers.length === 0 ? (
            <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
              No other peers yet. Open this project on another peer to collaborate.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="peers-list">
              {peers.map((peer) => (
                <li key={peer.peerId} className="flex items-center gap-2 text-callout">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: peer.color }}
                  />
                  <span style={{ color: 'var(--color-text)' }}>
                    {peer.displayName || PEER_NAME_FALLBACK}
                  </span>
                  {peer.activeSegmentId && (
                    <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                      · editing
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
