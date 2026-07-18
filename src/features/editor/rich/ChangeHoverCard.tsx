import { useEffect, useState, type RefObject } from 'react'
import { Check, X } from 'lucide-react'
import { resolveSegmentChange } from '../changes/resolveOps'
import type { ResolveAction } from './resolve'

interface CardState {
  changeId: string
  type: 'insert' | 'delete'
  author: string
  top: number
  left: number
}

/**
 * A small floating card shown when a tracked-change mark is clicked in the
 * editor, offering Accept / Reject for that single change. Reads the change's
 * identity from the mark's data attributes and resolves through the same
 * headless path as the Changes panel, so the segment (and its Yjs mirror /
 * version history) update consistently.
 */
export function ChangeHoverCard({
  segmentId,
  containerRef,
}: {
  segmentId: string
  containerRef: RefObject<HTMLElement | null>
}) {
  const [card, setCard] = useState<CardState | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      // Clicks inside the card itself (Accept/Reject) must not close it before
      // their handler runs — this native listener fires before React's onClick.
      if (el?.closest('[data-testid="change-hover-card"]')) return
      const mark = el?.closest('[data-change-id]') as HTMLElement | null
      if (!mark) {
        setCard(null)
        return
      }
      const changeId = mark.getAttribute('data-change-id')
      const type = mark.getAttribute('data-change-type') as 'insert' | 'delete' | null
      if (!changeId || !type) return
      const box = container.getBoundingClientRect()
      const rect = mark.getBoundingClientRect()
      setCard({
        changeId,
        type,
        author: (mark.getAttribute('title') || '').replace(/^(Insertion|Deletion) by /, ''),
        top: rect.bottom - box.top + 4,
        left: rect.left - box.left,
      })
    }

    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [containerRef])

  // Dismiss on Escape.
  useEffect(() => {
    if (!card) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCard(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [card])

  if (!card) return null

  const resolve = (action: ResolveAction) => {
    void resolveSegmentChange(segmentId, card.changeId, action)
    setCard(null)
  }

  return (
    <div
      role="dialog"
      aria-label="Resolve tracked change"
      data-testid="change-hover-card"
      className="absolute z-40 flex items-center gap-1 rounded-md border px-1.5 py-1 shadow-md"
      style={{
        top: card.top,
        left: card.left,
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
      // Keep the click from bubbling back to the container listener (which would
      // re-open/close the card) or moving the editor selection.
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="px-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
        {card.type === 'insert' ? 'Insertion' : 'Deletion'}
        {card.author ? ` · ${card.author}` : ''}
      </span>
      <button
        type="button"
        onClick={() => resolve('accept')}
        data-testid="change-hover-accept"
        aria-label="Accept change"
        className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-[var(--color-fill)]"
        style={{ color: 'var(--color-accent)' }}
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => resolve('reject')}
        data-testid="change-hover-reject"
        aria-label="Reject change"
        className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-[var(--color-fill)]"
        style={{ color: 'var(--color-error)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
