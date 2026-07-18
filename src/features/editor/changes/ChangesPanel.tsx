import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, X, GitCompare, Eye, EyeOff } from 'lucide-react'
import { versionRepo } from '@/storage/repositories/versionRepo'
import { colorForAuthor } from '@/core/history/authorColor'
import { useEditorActionsStore } from '../useEditorActionsStore'
import { useChangesStore } from './useChangesStore'
import { DiffText } from '../history/DiffText'
import { relativeTime } from '../history/relativeTime'
import {
  listPendingChanges,
  resolveSegmentChange,
  resolveProjectAll,
  type PendingChange,
} from './resolveOps'
import type { ResolveAction } from '../rich/resolve'

interface ChangesPanelProps {
  projectId: string
}

type Tab = 'suggestions' | 'history'

/**
 * Tracked-changes review (Phase 1.4). The "Suggestions" tab lists every pending
 * insert/delete suggestion live (from the segments' `targetRich`) and lets a
 * reviewer accept or reject each one — or all at once. The "History" tab keeps
 * the version-derived word-diff view. Clicking a suggestion jumps to its segment.
 */
export function ChangesPanel({ projectId }: ChangesPanelProps) {
  const [tab, setTab] = useState<Tab>('suggestions')
  return (
    <div className="flex flex-col gap-2" data-testid="changes-panel">
      <div
        role="tablist"
        aria-label="Changes view"
        className="inline-flex items-center gap-1 rounded-md border p-0.5 text-xs"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {(['suggestions', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            data-testid={`changes-tab-${t}`}
            onClick={() => setTab(t)}
            className="rounded px-2 py-1 capitalize transition-colors"
            style={{
              background: tab === t ? 'var(--color-accent-fill)' : 'transparent',
              color: tab === t ? 'var(--color-accent)' : 'var(--color-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'suggestions' ? (
        <SuggestionsView projectId={projectId} />
      ) : (
        <HistoryView projectId={projectId} />
      )}
    </div>
  )
}

function SuggestionsView({ projectId }: ChangesPanelProps) {
  const pending = useLiveQuery(() => listPendingChanges(projectId), [projectId])
  const actions = useEditorActionsStore((s) => s.actions)

  if (!pending) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </p>
    )
  }

  if (pending.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border p-3 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="suggestions-empty"
      >
        <GitCompare size={16} />
        No pending suggestions. Turn on suggesting mode to propose edits.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="suggestions-results">
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        <span>
          {pending.length} pending suggestion{pending.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void resolveProjectAll(projectId, 'accept')}
            data-testid="suggestions-accept-all"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-accent)' }}
          >
            <Check size={13} /> Accept all
          </button>
          <button
            onClick={() => void resolveProjectAll(projectId, 'reject')}
            data-testid="suggestions-reject-all"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-error)' }}
          >
            <X size={13} /> Reject all
          </button>
        </div>
      </div>

      {pending.map((c) => (
        <SuggestionRow
          key={c.id}
          change={c}
          onJump={() => actions?.jumpToSegment(c.segmentIndex + 1)}
        />
      ))}
    </div>
  )
}

function SuggestionRow({ change, onJump }: { change: PendingChange; onJump: () => void }) {
  const color = colorForAuthor(change.authorName)
  const isInsert = change.type === 'insert'
  const resolve = (action: ResolveAction) =>
    void resolveSegmentChange(change.segmentId, change.id, action)

  return (
    <div
      data-testid={`suggestion-${change.id}`}
      data-change-type={change.type}
      className="flex flex-col gap-1.5 rounded-md border p-2.5"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
        <button
          onClick={onJump}
          data-testid={`suggestion-jump-${change.segmentIndex}`}
          className="tabular-nums hover:underline"
          style={{ color: 'var(--color-muted)' }}
        >
          #{change.segmentIndex + 1}
        </button>
        <span className="inline-flex items-center gap-1" style={{ color }}>
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {change.authorName || 'Unknown'}
        </span>
        <span style={{ color: isInsert ? 'var(--color-accent)' : 'var(--color-error)' }}>
          {isInsert ? 'Insertion' : 'Deletion'}
        </span>
        <span className="ml-auto" style={{ color: 'var(--color-muted)' }}>
          {relativeTime(new Date(change.createdAt).toISOString())}
        </span>
      </div>

      <p
        className="text-sm whitespace-pre-wrap break-words"
        style={{
          color: 'var(--color-text)',
          textDecoration: isInsert ? 'underline' : 'line-through',
          textDecorationColor: color,
        }}
      >
        {change.text}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => resolve('accept')}
          data-testid={`suggestion-accept-${change.id}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:opacity-80"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          <Check size={13} /> Accept
        </button>
        <button
          onClick={() => resolve('reject')}
          data-testid={`suggestion-reject-${change.id}`}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:bg-[var(--color-fill)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-error)' }}
        >
          <X size={13} /> Reject
        </button>
      </div>
    </div>
  )
}

/** The original version-derived word-diff view, unchanged. */
function HistoryView({ projectId }: ChangesPanelProps) {
  const changes = useLiveQuery(() => versionRepo.latestChanges(projectId), [projectId])
  const actions = useEditorActionsStore((s) => s.actions)
  const showDiff = useChangesStore((s) => s.showDiff)
  const toggle = useChangesStore((s) => s.toggle)

  if (!changes) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </p>
    )
  }

  if (changes.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border p-3 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="changes-empty"
      >
        <GitCompare size={16} />
        No tracked changes yet. Save versions to compare edits over time.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="changes-panel-results">
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        <span>
          {changes.length} changed segment{changes.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1 hover:opacity-80"
          data-testid="changes-toggle-diff"
          aria-pressed={showDiff}
        >
          {showDiff ? <Eye size={13} /> : <EyeOff size={13} />}
          {showDiff ? 'Hide changes' : 'Show changes'}
        </button>
      </div>

      {changes.map((c) => {
        const color = colorForAuthor(c.author)
        return (
          <button
            key={c.segmentId}
            onClick={() => actions?.jumpToSegment(c.index + 1)}
            data-testid={`changes-item-${c.index}`}
            className="flex w-full flex-col gap-1 rounded-md border p-2.5 text-left transition-colors hover:bg-[var(--color-fill)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
              <span className="tabular-nums" style={{ color: 'var(--color-muted)' }}>
                #{c.index + 1}
              </span>
              <span
                className="inline-flex items-center gap-1"
                style={{ color }}
                data-testid="changes-author"
              >
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {c.author || 'Unknown'}
              </span>
              <span className="ml-auto" style={{ color: 'var(--color-muted)' }}>
                {relativeTime(c.createdAt)}
              </span>
            </div>
            {showDiff ? (
              <DiffText prev={c.before} next={c.after} addColor={color} />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
                {c.after}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
