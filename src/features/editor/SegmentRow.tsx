import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, Eye, MessageSquare, Pencil } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'
import { StatusPill } from './StatusPill'
import { SegmentComments } from './comments/SegmentComments'

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

interface SegmentRowProps {
  segment: Segment
  isFocused: boolean
  reviewMode: boolean
  /** Display name attached to comments this user adds. */
  commentAuthor?: string
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
  reviewMode,
  commentAuthor,
  onConfirm,
  onToggleReviewed,
  onMoveFocus,
  onFocus,
  registerTextarea,
}: SegmentRowProps) {
  const [target, setTarget] = useState(segment.target)
  const lastSavedRef = useRef(segment.target)
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState(segment.source)
  const lastSavedSourceRef = useRef(segment.source)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const commentCount = segment.comments?.length ?? 0

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

  // Keep the source draft in sync when the row is reused for another segment
  // or the source changes underneath us (e.g. propagated edit).
  useEffect(() => {
    if (segment.source !== lastSavedSourceRef.current) {
      setSourceDraft(segment.source)
      lastSavedSourceRef.current = segment.source
    }
  }, [segment.source])

  // Debounced autosave of an edited source, mirroring the target behaviour.
  useEffect(() => {
    if (!editingSource) return
    if (sourceDraft === lastSavedSourceRef.current) return
    const handle = setTimeout(() => {
      lastSavedSourceRef.current = sourceDraft
      void segmentRepo.update(segment.id, { source: sourceDraft })
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(handle)
  }, [sourceDraft, editingSource, segment.id])

  async function flushTarget() {
    if (target !== lastSavedRef.current) {
      lastSavedRef.current = target
      await segmentRepo.update(segment.id, { target })
    }
  }

  async function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      await flushTarget()
      onToggleReviewed()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      // Flush latest text first; await so EditorPage.confirm sees current DB state.
      await flushTarget()
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

  async function handleConfirmClick() {
    await flushTarget()
    if (reviewMode) {
      onToggleReviewed()
    } else {
      onConfirm()
    }
  }

  async function toggleEditSource() {
    if (editingSource && sourceDraft !== lastSavedSourceRef.current) {
      lastSavedSourceRef.current = sourceDraft
      await segmentRepo.update(segment.id, { source: sourceDraft })
    }
    setEditingSource((v) => !v)
  }

  const isCode = segment.sourceMeta?.kind === 'code'
  const isHeading = segment.sourceMeta?.kind === 'heading'
  const sourceTextClass = isCode
    ? 'whitespace-pre-wrap break-words text-sm'
    : isHeading
    ? 'text-sm font-semibold'
    : 'text-sm whitespace-pre-wrap'

  return (
    <div
      data-segment-row
      data-segment-id={segment.id}
      data-segment-index={segment.index}
      className="flex flex-col gap-2 rounded-md border px-3 py-2"
      style={{
        borderColor: isFocused ? 'var(--color-accent)' : 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="grid grid-cols-[2rem_1fr] md:grid-cols-[2.5rem_1fr_1fr_auto] gap-2 md:gap-3">
        <span
          className="text-xs pt-2 select-none"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {segment.index + 1}
        </span>

        <div className="flex flex-col gap-2 min-w-0 md:contents">
          <div className="flex flex-col gap-1 min-w-0 md:pt-2">
            {editingSource ? (
              <Textarea
                value={sourceDraft}
                onChange={(e) => setSourceDraft(e.target.value)}
                onBlur={() => void toggleEditSource()}
                aria-label={`Edit source ${segment.index + 1}`}
                data-testid={`source-edit-${segment.index}`}
                rows={Math.max(1, Math.min(8, segment.source.split('\n').length))}
                autoFocus
              />
            ) : (
              <div
                className={sourceTextClass}
                style={{
                  color: 'var(--color-text)',
                  fontFamily: isCode ? 'var(--font-mono)' : undefined,
                }}
              >
                {segment.source}
              </div>
            )}
            <button
              type="button"
              onClick={() => void toggleEditSource()}
              aria-label={editingSource ? 'Done editing source' : 'Edit source'}
              title={editingSource ? 'Done editing source' : 'Edit source'}
              data-testid={`edit-source-${segment.index}`}
              className="inline-flex items-center gap-1 self-start text-[10px] uppercase tracking-wider transition-opacity hover:opacity-100 opacity-60"
              style={{ color: 'var(--color-muted)' }}
            >
              <Pencil size={11} />
              {editingSource ? 'Done' : 'Source'}
            </button>
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

          <div className="flex flex-row md:flex-col items-center md:items-start gap-2 md:pt-2">
            <StatusPill status={segment.status} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleConfirmClick()}
                aria-label={reviewMode ? 'Mark reviewed' : 'Confirm segment'}
                title={
                  reviewMode
                    ? 'Mark reviewed (Ctrl+Shift+Enter)'
                    : 'Confirm segment (Ctrl+Enter)'
                }
                data-testid={`confirm-${segment.index}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors hover:bg-[var(--color-fill)]"
                style={{
                  borderColor: 'var(--color-border)',
                  color: reviewMode ? 'var(--color-accent)' : 'var(--color-confirm)',
                }}
              >
                {reviewMode ? <Eye size={15} /> : <Check size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setCommentsOpen((v) => !v)}
                aria-label={commentsOpen ? 'Hide comments' : 'Show comments'}
                aria-expanded={commentsOpen}
                title="Comments"
                data-testid={`comments-toggle-${segment.index}`}
                className="relative inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors hover:bg-[var(--color-fill)]"
                style={{
                  borderColor: commentsOpen ? 'var(--color-accent)' : 'var(--color-border)',
                  color: commentCount > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                }}
              >
                <MessageSquare size={15} />
                {commentCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-semibold tabular-nums"
                    style={{ background: 'var(--color-accent)', color: 'white' }}
                    aria-hidden
                  >
                    {commentCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {commentsOpen && (
        <SegmentComments
          segmentId={segment.id}
          comments={segment.comments ?? []}
          author={commentAuthor}
        />
      )}
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
