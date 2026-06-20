import { Link } from 'react-router-dom'
import { Pencil, Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StatusCounts } from '@/storage/repositories/segmentRepo'
import type { Project } from '@/core/types'
import { useProjectDialogsStore, type ProjectDialogKind } from './useProjectDialogsStore'

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function projectProgress(
  counts: StatusCounts | undefined,
): { total: number; done: number; pct: number } {
  if (!counts) return { total: 0, done: 0, pct: 0 }
  const total =
    counts.untranslated + counts.draft + counts.translated + counts.reviewed + counts.locked
  const done = counts.translated + counts.reviewed + counts.locked
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-fill)]"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-muted)' }}
    >
      {children}
    </button>
  )
}

export function ProjectCard({ project, counts }: { project: Project; counts?: StatusCounts }) {
  const { total, done, pct } = projectProgress(counts)
  const openDialog = useProjectDialogsStore((s) => s.open)
  const act = (kind: ProjectDialogKind) => openDialog(kind, project.id)

  return (
    <li
      className="relative rounded-md border transition-colors hover:bg-[var(--color-fill)]"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      data-testid={`project-card-${project.id}`}
    >
      <Link to={`/project/${project.id}`} className="block px-4 py-3 pr-28 min-h-hit">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-callout font-medium truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {project.name}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-footnote" style={{ color: 'var(--color-muted)' }}>
          <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
            {project.sourceLang} → {project.targetLang}
          </Badge>
          <span>Updated {formatRelative(project.updatedAt)}</span>
          {total > 0 && (
            <span className="tabular-nums">
              · {done}/{total} ({pct}%)
            </span>
          )}
        </div>
        {total > 0 && (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--color-fill)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
            />
          </div>
        )}
      </Link>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        <ActionButton label="Edit project" onClick={() => act('edit')}>
          <Pencil size={16} />
        </ActionButton>
        <ActionButton label="Duplicate project" onClick={() => act('duplicate')}>
          <Copy size={16} />
        </ActionButton>
        <ActionButton label="Delete project" onClick={() => act('delete')} danger>
          <Trash2 size={16} />
        </ActionButton>
      </div>
    </li>
  )
}
