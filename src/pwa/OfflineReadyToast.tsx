import { useEffect, useState } from 'react'
import { CloudOff, X } from 'lucide-react'
import { OFFLINE_READY_ACK_KEY, usePwaStore } from './usePwaStore'

function hasAcknowledged(): boolean {
  try {
    return localStorage.getItem(OFFLINE_READY_ACK_KEY) === '1'
  } catch {
    return false
  }
}

export function OfflineReadyToast() {
  const offlineReady = usePwaStore((s) => s.offlineReady)
  const ackOfflineReady = usePwaStore((s) => s.ackOfflineReady)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (offlineReady && !hasAcknowledged()) {
      setVisible(true)
    }
  }, [offlineReady])

  if (!visible) return null

  const handleDismiss = () => {
    try {
      localStorage.setItem(OFFLINE_READY_ACK_KEY, '1')
    } catch {
      // Ignore quota / private-mode errors.
    }
    setVisible(false)
    ackOfflineReady()
  }

  return (
    <div
      role="status"
      data-testid="pwa-offline-ready-toast"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border px-4 py-2 shadow-lg"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <CloudOff size={14} style={{ color: 'var(--color-accent)' }} />
      <span className="text-sm">VERBALIS is ready to work offline.</span>
      <button
        onClick={handleDismiss}
        className="p-1 rounded"
        style={{ color: 'var(--color-muted)' }}
        aria-label="Dismiss offline ready notification"
        data-testid="pwa-offline-ready-dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
