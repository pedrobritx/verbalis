import { useEffect, useRef, useState } from 'react'
import { Lock, Unlock, MoreVertical, SplitSquareHorizontal, Combine, History } from 'lucide-react'

interface SegmentActionsMenuProps {
  locked: boolean
  /** Split/join are disabled for bilingual (XLIFF) projects to protect round-trip. */
  isBilingual: boolean
  /** Whether a joinable next segment exists in the same source block. */
  canJoinNext: boolean
  onToggleLock: () => void
  onSplit: () => void
  onJoin: () => void
  onShowHistory: () => void
}

interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  title?: string
}

export function SegmentActionsMenu({
  locked,
  isBilingual,
  canJoinNext,
  onToggleLock,
  onSplit,
  onJoin,
  onShowHistory,
}: SegmentActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const splitTitle = isBilingual
    ? 'Not available for XLIFF projects (would break round-trip)'
    : undefined
  const joinTitle = isBilingual
    ? 'Not available for XLIFF projects (would break round-trip)'
    : !canJoinNext
    ? 'No segment to join in the same block'
    : undefined

  const items: MenuItem[] = [
    {
      key: 'lock',
      label: locked ? 'Unlock segment' : 'Lock segment',
      icon: locked ? <Unlock size={14} /> : <Lock size={14} />,
      onSelect: onToggleLock,
    },
    {
      key: 'split',
      label: 'Split…',
      icon: <SplitSquareHorizontal size={14} />,
      onSelect: onSplit,
      disabled: isBilingual,
      title: splitTitle,
    },
    {
      key: 'join',
      label: 'Join with next',
      icon: <Combine size={14} />,
      onSelect: onJoin,
      disabled: isBilingual || !canJoinNext,
      title: joinTitle,
    },
    {
      key: 'history',
      label: 'Row history…',
      icon: <History size={14} />,
      onSelect: onShowHistory,
    },
  ]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Segment actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Segment actions"
        data-testid="segment-actions-trigger"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors hover:bg-[var(--color-fill)]"
        style={{
          borderColor: open ? 'var(--color-accent)' : 'var(--color-border)',
          color: 'var(--color-muted)',
        }}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="segment-actions-menu"
          className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-md border p-1 shadow-md"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              data-testid={`segment-action-${item.key}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left transition-colors hover:bg-[var(--color-fill)] disabled:opacity-40 disabled:pointer-events-none"
              style={{ color: 'var(--color-text)' }}
            >
              <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
