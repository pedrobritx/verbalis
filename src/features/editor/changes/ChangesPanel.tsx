import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, EyeOff, GitCompare } from 'lucide-react'
import { versionRepo } from '@/storage/repositories/versionRepo'
import { colorForAuthor } from '@/core/history/authorColor'
import { useEditorActionsStore } from '../useEditorActionsStore'
import { useChangesStore } from './useChangesStore'
import { DiffText } from '../history/DiffText'
import { relativeTime } from '../history/relativeTime'

interface ChangesPanelProps {
  projectId: string
}

/**
 * Project-wide tracked changes (Phase 12, read-only). Lists every segment whose
 * target changed across saved versions, newest change attributed to its author
 * and colour-coded, with a word diff and a show/hide toggle. Click a row to jump
 * to the segment. Builds entirely on the shipped F2 version history.
 */
export function ChangesPanel({ projectId }: ChangesPanelProps) {
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
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
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
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
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
