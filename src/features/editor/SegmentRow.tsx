import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, Eye, Lock, MessageSquare, Pencil } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { Segment } from '@/core/types'
import { StatusPill } from './StatusPill'
import { SegmentComments } from './comments/SegmentComments'
import { SegmentActionsMenu } from './segments/SegmentActionsMenu'
import { useSegmentOpsStore } from './segments/useSegmentOpsStore'
import { useSegmentHistoryStore } from './history/useSegmentHistoryStore'
import type { SegmentEditorHandle } from './SegmentEditorHandle'

// Lexical only loads when rich editing is actually used, keeping it out of the
// main bundle for the default (plain-text) path.
const RichSegmentEditor = lazy(() =>
  import('./rich/RichSegmentEditor').then((m) => ({ default: m.RichSegmentEditor })),
)

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

interface SegmentRowProps {
  segment: Segment
  isFocused: boolean
  reviewMode: boolean
  /** XLIFF projects can't split/join without breaking round-trip. */
  isBilingual: boolean
  /** Whether the following segment can be joined into this one. */
  canJoinNext: boolean
  /** Use the Lexical rich-text target editor (code segments stay plain). */
  richEditing: boolean
  /** Display name attached to comments this user adds. */
  commentAuthor?: string
  onConfirm: () => void
  onToggleReviewed: () => void
  onJoin: () => void
  onMoveFocus: (direction: -1 | 1) => void
  onFocus: () => void
  registerHandle: (handle: SegmentEditorHandle | null) => void
}

const AUTOSAVE_DELAY_MS = 300

export function SegmentRow({
  segment,
  isFocused,
  reviewMode,
  isBilingual,
  canJoinNext,
  richEditing,
  commentAuthor,
  onConfirm,
  onToggleReviewed,
  onJoin,
  onMoveFocus,
  onFocus,
  registerHandle,
}: SegmentRowProps) {
  const [target, setTarget] = useState(segment.target)
  const lastSavedRef = useRef(segment.target)
  const [editingSource, setEditingSource] = useState(false)
  const [sourceDraft, setSourceDraft] = useState(segment.source)
  const lastSavedSourceRef = useRef(segment.source)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const commentCount = segment.comments?.length ?? 0
  const locked = !!segment.locked
  const openSplit = useSegmentOpsStore((s) => s.openSplit)
  const openHistory = useSegmentHistoryStore((s) => s.open)
  const isCode = segment.sourceMeta?.kind === 'code'
  const useRich = richEditing && !isCode

  // Plain-path focusable handle: wraps the textarea so the page can drive focus
  // and glossary insertion uniformly across plain and rich editors.
  const taElRef = useRef<HTMLTextAreaElement | null>(null)
  const plainHandleRef = useRef<SegmentEditorHandle>({
    focus: () => taElRef.current?.focus(),
    insertText: (text) => {
      const el = taElRef.current
      if (!el) return
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + text + el.value.slice(end)
      setTarget(next)
      requestAnimationFrame(() => {
        const node = taElRef.current
        if (!node) return
        node.focus()
        const caret = start + text.length
        try {
          node.setSelectionRange(caret, caret)
        } catch {
          // selection range not supported — ignore.
        }
      })
    },
  })

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
    // Ctrl/⌘+J joins this segment with the next (memoQ parity), when allowed.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault()
      if (!isBilingual && canJoinNext) {
        await flushTarget()
        onJoin()
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (locked) return
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
    if (locked) return
    if (editingSource && sourceDraft !== lastSavedSourceRef.current) {
      lastSavedSourceRef.current = sourceDraft
      await segmentRepo.update(segment.id, { source: sourceDraft })
    }
    setEditingSource((v) => !v)
  }

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
      data-locked={locked ? 'true' : undefined}
      className="flex flex-col gap-2 rounded-md border px-3 py-2"
      style={{
        borderColor: isFocused ? 'var(--color-accent)' : 'var(--color-border)',
        background: locked ? 'var(--color-fill-secondary)' : 'var(--color-surface)',
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
                autoResize
                rows={1}
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
            {!locked && (
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
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            {useRich ? (
              <Suspense
                fallback={
                  <div
                    className="min-h-[2.5rem] rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                  >
                    {segment.target || 'Translation…'}
                  </div>
                }
              >
                <RichSegmentEditor
                  key={segment.id}
                  segmentId={segment.id}
                  index={segment.index}
                  initialPlain={segment.target}
                  initialRich={segment.targetRich}
                  externalPlain={segment.target}
                  externalRich={segment.targetRich}
                  status={segment.status}
                  locked={locked}
                  isBilingual={isBilingual}
                  canJoinNext={canJoinNext}
                  registerHandle={registerHandle}
                  onFocus={onFocus}
                  onConfirm={onConfirm}
                  onToggleReviewed={onToggleReviewed}
                  onJoin={onJoin}
                  onMoveFocus={onMoveFocus}
                />
              </Suspense>
            ) : (
              <Textarea
                ref={(el) => {
                  taElRef.current = el
                  registerHandle(el ? plainHandleRef.current : null)
                }}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                readOnly={locked}
                autoResize
                placeholder={locked ? 'Locked' : 'Translation…'}
                rows={1}
                data-testid={`target-${segment.index}`}
                aria-describedby={`seg-${segment.index}-counter`}
                style={locked ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
              />
            )}
            <SegmentCounter
              id={`seg-${segment.index}-counter`}
              source={segment.source}
              target={useRich ? segment.target : target}
            />
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-start gap-2 md:pt-2">
            <div className="flex items-center gap-1.5">
              <StatusPill status={segment.status} />
              {locked && (
                <span
                  className="inline-flex items-center"
                  style={{ color: 'var(--color-muted)' }}
                  title="Locked"
                  aria-label="Locked"
                  data-testid={`lock-indicator-${segment.index}`}
                >
                  <Lock size={12} />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleConfirmClick()}
                disabled={locked}
                aria-label={reviewMode ? 'Mark reviewed' : 'Confirm segment'}
                title={
                  locked
                    ? 'Segment is locked'
                    : reviewMode
                    ? 'Mark reviewed (Ctrl+Shift+Enter)'
                    : 'Confirm segment (Ctrl+Enter)'
                }
                data-testid={`confirm-${segment.index}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors hover:bg-[var(--color-fill)] disabled:opacity-40 disabled:pointer-events-none"
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
              <SegmentActionsMenu
                locked={locked}
                isBilingual={isBilingual}
                canJoinNext={canJoinNext}
                onToggleLock={() => void segmentRepo.setLocked(segment.id, !locked)}
                onSplit={() => openSplit(segment.id)}
                onJoin={onJoin}
                onShowHistory={() => openHistory(segment.projectId, segment.id)}
              />
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
