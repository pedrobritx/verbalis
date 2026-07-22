import { Wifi, WifiOff } from 'lucide-react'
import { usePresenceStore } from './usePresenceStore'

interface PeersPresenceChipProps {
  /** Opens the Peers panel (handles desktop sidebar vs. mobile sheet upstream). */
  onOpen: () => void
}

/**
 * Header affordance for live collaboration. Peers used to be one of eight crammed
 * sidebar tabs; pulling it out to a compact, always-available chip both declutters
 * the panel and keeps presence visible from every workflow stage.
 */
export function PeersPresenceChip({ onOpen }: PeersPresenceChipProps) {
  const shared = usePresenceStore((s) => s.shared)
  const peers = usePresenceStore((s) => s.peers)

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="peers-presence-chip"
      aria-label={shared ? `Peers — ${peers.length} on this network` : 'Peers — sharing off'}
      title={
        shared
          ? `${peers.length} peer${peers.length === 1 ? '' : 's'} on this network`
          : 'Share with peers on this network'
      }
      className="inline-flex items-center gap-1.5 rounded-full border h-9 px-3 text-footnote transition-colors hover:bg-[var(--color-fill)]"
      style={{
        borderColor: shared ? 'var(--color-accent)' : 'var(--color-border)',
        color: shared ? 'var(--color-accent)' : 'var(--color-muted)',
        background: shared ? 'var(--color-accent-fill)' : 'transparent',
      }}
    >
      {shared ? <Wifi size={14} /> : <WifiOff size={14} />}
      {shared && <span className="tabular-nums">{peers.length}</span>}
    </button>
  )
}
