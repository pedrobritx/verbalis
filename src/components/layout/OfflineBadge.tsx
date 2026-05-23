import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function OfflineBadge() {
  const online = useNetworkStatus()
  if (online) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-muted)',
      }}
      data-testid="offline-badge"
      title="You are offline. Local features continue to work."
    >
      <WifiOff size={10} />
      <span>Offline</span>
    </span>
  )
}
