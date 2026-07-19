import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, RotateCcw, Trash2, Reply } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { SegmentComment } from '@/core/types'
import { relativeTime } from '../history/relativeTime'
import {
  groupThreads,
  addRootComment,
  addReply,
  setThreadResolved,
  deleteThread,
  type CommentThread,
} from './commentOps'

interface SegmentCommentsProps {
  segmentId: string
  comments: SegmentComment[]
  /** Display name to attach to new comments, when a profile identity is set. */
  author?: string
}

/**
 * Threaded comments for a segment (Phase 1.5). Each thread is a root comment
 * (optionally anchored to a highlighted range in the target) plus replies.
 * Anchored roots created from the format toolbar already exist here; this panel
 * also supports plain, un-anchored segment-level comments and replies.
 */
export function SegmentComments({ segmentId, comments, author }: SegmentCommentsProps) {
  const [draft, setDraft] = useState('')
  const threads = groupThreads(comments)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    await addRootComment(segmentId, body, author)
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-2.5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-fill-secondary)' }}
      data-testid={`segment-comments-${segmentId}`}
    >
      {threads.length > 0 && (
        <ul className="flex flex-col gap-2">
          {threads.map((thread) => (
            <ThreadView key={thread.root.id} segmentId={segmentId} thread={thread} author={author} />
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

function CommentBubble({ c }: { c: SegmentComment }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-wider"
        style={{ color: 'var(--color-muted)' }}
      >
        <span className="font-semibold truncate">{c.author || 'You'}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{relativeTime(c.createdAt)}</span>
      </div>
      <p
        className="whitespace-pre-wrap break-words"
        style={{ color: 'var(--color-text)' }}
      >
        {c.body}
      </p>
    </div>
  )
}

function ThreadView({
  segmentId,
  thread,
  author,
}: {
  segmentId: string
  thread: CommentThread
  author?: string
}) {
  const { root, replies } = thread
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)

  async function submitReply(e: FormEvent) {
    e.preventDefault()
    const body = reply.trim()
    if (!body) return
    setReply('')
    setReplying(false)
    await addReply(segmentId, root.id, body, author)
  }

  return (
    <li
      className="flex flex-col gap-1.5 rounded-md px-2 py-1.5 text-sm"
      style={{ background: 'var(--color-surface)', opacity: root.resolved ? 0.6 : 1 }}
      data-testid={`comment-thread-${root.id}`}
      data-resolved={root.resolved ? 'true' : 'false'}
    >
      {root.quote && (
        <p
          className="text-xs italic border-l-2 pl-2 line-clamp-2"
          style={{ color: 'var(--color-muted)', borderColor: 'var(--color-accent)' }}
        >
          “{root.quote}”
        </p>
      )}
      <div className="flex items-start gap-2">
        <CommentBubble c={root} />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            aria-label="Reply"
            title="Reply"
            data-testid={`comment-reply-toggle-${root.id}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-muted)' }}
          >
            <Reply size={13} />
          </button>
          <button
            type="button"
            onClick={() => void setThreadResolved(segmentId, root, !root.resolved)}
            aria-label={root.resolved ? 'Reopen thread' : 'Resolve thread'}
            title={root.resolved ? 'Reopen thread' : 'Resolve thread'}
            data-testid={`comment-resolve-${root.id}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: root.resolved ? 'var(--color-muted)' : 'var(--color-confirm)' }}
          >
            {root.resolved ? <RotateCcw size={13} /> : <Check size={14} />}
          </button>
          <button
            type="button"
            onClick={() => void deleteThread(segmentId, thread)}
            aria-label="Delete thread"
            title="Delete thread"
            data-testid={`comment-delete-${root.id}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l pl-2" style={{ borderColor: 'var(--color-border)' }}>
          {replies.map((r) => (
            <li key={r.id} data-testid={`comment-reply-${r.id}`}>
              <CommentBubble c={r} />
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <form onSubmit={submitReply} className="flex flex-col gap-1 pl-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply…"
            autoResize
            rows={1}
            autoFocus
            aria-label="Reply"
            data-testid={`comment-reply-input-${root.id}`}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                void submitReply(e)
              }
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="tinted" size="sm" disabled={!reply.trim()}>
              Reply
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
