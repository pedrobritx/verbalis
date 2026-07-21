import { cn } from '@/lib/utils'
import type { StatusCounts } from '@/storage/repositories/segmentRepo'
import type { SegmentStatus } from '@/core/types'
import { useEditorModeStore, type StatusFilter } from './useEditorModeStore'

interface StatusFilterBarProps {
  /** Status counts derived from the editor's already-loaded segments. */
  counts: StatusCounts | undefined
}

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'untranslated', label: 'Untranslated' },
  { id: 'draft', label: 'Draft' },
  { id: 'translated', label: 'Translated' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'locked', label: 'Locked' },
]

export function StatusFilterBar({ counts }: StatusFilterBarProps) {
  const statusFilter = useEditorModeStore((s) => s.statusFilter)
  const setStatusFilter = useEditorModeStore((s) => s.setStatusFilter)

  const total = counts
    ? counts.untranslated + counts.draft + counts.translated + counts.reviewed + counts.locked
    : 0

  function countFor(id: StatusFilter): number {
    if (!counts) return 0
    if (id === 'all') return total
    return counts[id as SegmentStatus]
  }

  return (
    <div
      role="group"
      aria-label="Filter segments by status"
      data-testid="status-filter-bar"
      className="flex flex-wrap items-center gap-1.5"
    >
      {FILTERS.map((f) => {
        const isActive = statusFilter === f.id
        const count = countFor(f.id)
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            aria-pressed={isActive}
            data-testid={`status-filter-${f.id}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              isActive ? 'font-semibold' : 'hover:opacity-80',
            )}
            style={{
              borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
              background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
            }}
          >
            <span>{f.label}</span>
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
