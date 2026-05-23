import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'
import { StatusPill } from './StatusPill'

interface SegmentRowProps {
  segment: Segment
  isFocused: boolean
  onConfirm: () => void
  onMoveFocus: (direction: -1 | 1) => void
  onFocus: () => void
  registerTextarea: (el: HTMLTextAreaElement | null) => void
}

const AUTOSAVE_DELAY_MS = 300

export function SegmentRow({
  segment,
  isFocused,
  onConfirm,
  onMoveFocus,
  onFocus,
  registerTextarea,
}: SegmentRowProps) {
  const [target, setTarget] = useState(segment.target)
  const lastSavedRef = useRef(segment.target)

  useEffect(() => {
    if (segment.target !== lastSavedRef.current) {
      setTarget(segment.target)
      lastSavedRef.current = segment.target
    }
  }, [segment.target])

  useEffect(() => {
    if (target === lastSavedRef.current) return
    const handle = setTimeout(() => {
      const trimmed = target.trim()
      const changes: Partial<Segment> = { target }
      if (segment.status === 'untranslated' && trimmed.length > 0) {
        changes.status = 'draft'
      } else if (segment.status === 'draft' && trimmed.length === 0) {
        changes.status = 'untranslated'
      }
      lastSavedRef.current = target
      void segmentRepo.update(segment.id, changes)
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(handle)
  }, [target, segment.id, segment.status])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      // flush latest text first
      if (target !== lastSavedRef.current) {
        lastSavedRef.current = target
        void segmentRepo.update(segment.id, { target })
      }
      onConfirm()
      return
    }
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault()
      onMoveFocus(1)
      return
    }
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault()
      onMoveFocus(-1)
    }
  }

  const isCode = segment.sourceMeta?.kind === 'code'
  const isHeading = segment.sourceMeta?.kind === 'heading'

  return (
    <div
      data-segment-row
      data-segment-id={segment.id}
      data-segment-index={segment.index}
      className="grid grid-cols-[2.5rem_1fr_1fr_auto] gap-3 rounded-md border px-3 py-2"
      style={{
        borderColor: isFocused ? 'var(--color-accent)' : 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="text-xs pt-2 select-none"
        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {segment.index + 1}
      </span>

      <div
        className={
          isCode
            ? 'whitespace-pre-wrap break-words pt-2 text-sm'
            : isHeading
            ? 'pt-2 text-sm font-semibold'
            : 'pt-2 text-sm whitespace-pre-wrap'
        }
        style={{
          color: 'var(--color-text)',
          fontFamily: isCode ? 'var(--font-mono)' : undefined,
        }}
      >
        {segment.source}
      </div>

      <Textarea
        ref={registerTextarea}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder="Translation…"
        rows={Math.max(1, Math.min(8, segment.source.split('\n').length))}
        data-testid={`target-${segment.index}`}
      />

      <div className="flex items-start pt-2">
        <StatusPill status={segment.status} />
      </div>
    </div>
  )
}
