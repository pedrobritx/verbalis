import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { SegmentComment } from '@/core/types'

interface SegmentCommentsProps {
  segmentId: string
  comments: SegmentComment[]
  /** Display name to attach to new comments, when a profile identity is set. */
  author?: string
}

/** Compact relative time ("just now", "5m", "3h", "2d"); falls back to a date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString()
}

export function SegmentComments({ segmentId, comments, author }: SegmentCommentsProps) {
  const [draft, setDraft] = useState('')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    const comment: SegmentComment = {
      id: crypto.randomUUID(),
      body,
      author: author?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    setDraft('')
    await segmentRepo.addComment(segmentId, comment)
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-2.5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-fill-secondary)' }}
      data-testid={`segment-comments-${segmentId}`}
    >
      {comments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
              style={{
                background: 'var(--color-surface)',
                opacity: c.resolved ? 0.6 : 1,
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div
                  className="flex items-center gap-2 text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <span className="font-semibold truncate">{c.author || 'You'}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{relativeTime(c.createdAt)}</span>
                  {c.resolved && <span aria-hidden>· resolved</span>}
                </div>
                <p
                  className="whitespace-pre-wrap break-words"
                  style={{
                    color: 'var(--color-text)',
                    textDecoration: c.resolved ? 'line-through' : undefined,
                  }}
                >
                  {c.body}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void segmentRepo.updateComment(segmentId, c.id, { resolved: !c.resolved })
                  }
                  aria-label={c.resolved ? 'Reopen comment' : 'Resolve comment'}
                  title={c.resolved ? 'Reopen comment' : 'Resolve comment'}
                  className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-[var(--color-fill)]"
                  style={{ color: c.resolved ? 'var(--color-muted)' : 'var(--color-confirm)' }}
                >
                  {c.resolved ? <RotateCcw size={13} /> : <Check size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => void segmentRepo.deleteComment(segmentId, c.id)}
                  aria-label="Delete comment"
                  title="Delete comment"
                  className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-[var(--color-fill)]"
                  style={{ color: 'var(--color-error)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          autoResize
          rows={2}
          aria-label="New comment"
          data-testid={`comment-input-${segmentId}`}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleAdd(e)
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="tinted" size="sm" disabled={!draft.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  )
}
