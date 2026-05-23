import { RefreshCw, X } from 'lucide-react'
import { usePwaStore } from './usePwaStore'

export function UpdateBanner() {
  const needRefresh = usePwaStore((s) => s.needRefresh)
  const updateSW = usePwaStore((s) => s.updateSW)
  const dismissRefresh = usePwaStore((s) => s.dismissRefresh)

  if (!needRefresh) return null

  const handleReload = () => {
    if (updateSW) void updateSW(true)
    else window.location.reload()
  }

  return (
    <div
      role="status"
      data-testid="pwa-update-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-md border px-4 py-2 shadow-lg"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <RefreshCw size={14} style={{ color: 'var(--color-accent)' }} />
      <span className="text-sm">A new version of VERBALIS is available.</span>
      <button
        onClick={handleReload}
        className="rounded border px-2 py-1 text-xs font-medium"
        style={{
          borderColor: 'var(--color-accent)',
          color: 'var(--color-accent)',
        }}
        data-testid="pwa-update-reload"
      >
        Reload
      </button>
      <button
        onClick={dismissRefresh}
        className="p-1 rounded"
        style={{ color: 'var(--color-muted)' }}
        aria-label="Dismiss update notification"
        data-testid="pwa-update-dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
