import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'
import { StatusPill } from './StatusPill'

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

interface SegmentRowProps {
  segment: Segment
  isFocused: boolean
  onConfirm: () => void
  onToggleReviewed: () => void
  onMoveFocus: (direction: -1 | 1) => void
  onFocus: () => void
  registerTextarea: (el: HTMLTextAreaElement | null) => void
}

const AUTOSAVE_DELAY_MS = 300

export function SegmentRow({
  segment,
  isFocused,
  onConfirm,
  onToggleReviewed,
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

  async function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      if (target !== lastSavedRef.current) {
        lastSavedRef.current = target
        await segmentRepo.update(segment.id, { target })
      }
      onToggleReviewed()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      // Flush latest text first; await so EditorPage.confirm sees current DB state.
      if (target !== lastSavedRef.current) {
        lastSavedRef.current = target
        await segmentRepo.update(segment.id, { target })
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
      className="grid grid-cols-[2rem_1fr] md:grid-cols-[2.5rem_1fr_1fr_auto] gap-2 md:gap-3 rounded-md border px-3 py-2"
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

      <div className="flex flex-col gap-2 min-w-0 md:contents">
        <div
          className={
            isCode
              ? 'whitespace-pre-wrap break-words md:pt-2 text-sm'
              : isHeading
              ? 'md:pt-2 text-sm font-semibold'
              : 'md:pt-2 text-sm whitespace-pre-wrap'
          }
          style={{
            color: 'var(--color-text)',
            fontFamily: isCode ? 'var(--font-mono)' : undefined,
          }}
        >
          {segment.source}
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <Textarea
            ref={registerTextarea}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            placeholder="Translation…"
            rows={Math.max(1, Math.min(8, segment.source.split('\n').length))}
            data-testid={`target-${segment.index}`}
            aria-describedby={`seg-${segment.index}-counter`}
          />
          <SegmentCounter
            id={`seg-${segment.index}-counter`}
            source={segment.source}
            target={target}
          />
        </div>

        <div className="flex items-start md:pt-2">
          <StatusPill status={segment.status} />
        </div>
      </div>
    </div>
  )
}

interface SegmentCounterProps {
  id: string
  source: string
  target: string
}

function SegmentCounter({ id, source, target }: SegmentCounterProps) {
  const stats = useMemo(() => {
    const srcW = countWords(source)
    const tgtW = countWords(target)
    const srcC = source.length
    const tgtC = target.length
    const ratio = srcW > 0 && tgtW > 0 ? tgtW / srcW : null
    return { srcW, tgtW, srcC, tgtC, ratio }
  }, [source, target])
  if (stats.srcW === 0 && stats.tgtW === 0) return null
  // Flag when the target is dramatically shorter or longer than the source
  // (outside the 0.5×–2× band). Most language pairs sit within ±30%, so this
  // catches gross length anomalies without nagging on routine variance.
  const flagRatio = stats.ratio !== null && (stats.ratio < 0.5 || stats.ratio > 2)
  return (
    <div
      id={id}
      className="flex items-center gap-2 text-[10px] tabular-nums select-none"
      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
      data-testid={`segment-counter-${id}`}
    >
      <span>
        src {stats.srcW}w · {stats.srcC}c
      </span>
      <span aria-hidden>·</span>
      <span>
        tgt {stats.tgtW}w · {stats.tgtC}c
      </span>
      {stats.ratio !== null && (
        <>
          <span aria-hidden>·</span>
          <span style={flagRatio ? { color: 'var(--color-warning)' } : undefined}>
            {stats.ratio.toFixed(2)}×
          </span>
        </>
      )}
    </div>
  )
}
