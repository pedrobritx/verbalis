import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageSquare, Check, RotateCcw } from 'lucide-react'
import { relativeTime } from '../history/relativeTime'
import { useEditorActionsStore } from '../useEditorActionsStore'
import { listProjectThreads, setThreadResolved, type ProjectThread } from './commentOps'

type Filter = 'open' | 'resolved' | 'all'

/**
 * Project-wide comment threads (Phase 1.5). Lists every thread across the
 * project's segments, filterable by open/resolved, with a resolve toggle and
 * click-to-jump to the segment. Reads live from the segments' inline comments.
 */
export function CommentsPanel({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<Filter>('open')
  const threads = useLiveQuery(() => listProjectThreads(projectId), [projectId])
  const actions = useEditorActionsStore((s) => s.actions)

  if (!threads) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </p>
    )
  }

  const visible = threads.filter((t) =>
    filter === 'all' ? true : filter === 'resolved' ? t.root.resolved : !t.root.resolved,
  )

  return (
    <div className="flex flex-col gap-2" data-testid="comments-panel">
      <div
        role="tablist"
        aria-label="Comment filter"
        className="inline-flex items-center gap-1 rounded-md border p-0.5 text-xs"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {(['open', 'resolved', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            data-testid={`comments-filter-${f}`}
            onClick={() => setFilter(f)}
            className="rounded px-2 py-1 capitalize transition-colors"
            style={{
              background: filter === f ? 'var(--color-accent-fill)' : 'transparent',
              color: filter === f ? 'var(--color-accent)' : 'var(--color-muted)',
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div
          className="flex items-center gap-2 rounded-md border p-3 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          data-testid="comments-empty"
        >
          <MessageSquare size={16} />
          No {filter === 'all' ? '' : filter} comments.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="comments-results">
          {visible.map((t) => (
            <ThreadCard key={t.root.id} thread={t} onJump={() => actions?.jumpToSegment(t.segmentIndex + 1)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ThreadCard({ thread, onJump }: { thread: ProjectThread; onJump: () => void }) {
  const { root, replies, segmentId, segmentIndex } = thread
  return (
    <li
      data-testid={`comments-thread-${root.id}`}
      data-resolved={root.resolved ? 'true' : 'false'}
      className="flex flex-col gap-1 rounded-md border p-2.5 text-sm"
      style={{ borderColor: 'var(--color-border)', opacity: root.resolved ? 0.6 : 1 }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
        <button
          onClick={onJump}
          data-testid={`comments-jump-${segmentIndex}`}
          className="tabular-nums hover:underline"
          style={{ color: 'var(--color-muted)' }}
        >
          #{segmentIndex + 1}
        </button>
        <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
          {root.author || 'You'}
        </span>
        <span className="ml-auto" style={{ color: 'var(--color-muted)' }}>
          {relativeTime(root.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => void setThreadResolved(segmentId, root, !root.resolved)}
          aria-label={root.resolved ? 'Reopen thread' : 'Resolve thread'}
          title={root.resolved ? 'Reopen thread' : 'Resolve thread'}
          data-testid={`comments-resolve-${root.id}`}
          className="inline-flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-[var(--color-fill)]"
          style={{ color: root.resolved ? 'var(--color-muted)' : 'var(--color-confirm)' }}
        >
          {root.resolved ? <RotateCcw size={12} /> : <Check size={13} />}
        </button>
      </div>
      {root.quote && (
        <p
          className="text-xs italic border-l-2 pl-2 line-clamp-1"
          style={{ color: 'var(--color-muted)', borderColor: 'var(--color-accent)' }}
        >
          “{root.quote}”
        </p>
      )}
      <p className="whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
        {root.body}
      </p>
      {replies.length > 0 && (
        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
        </span>
      )}
    </li>
  )
}
