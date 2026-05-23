import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/providers'
import { useLocation, matchPath } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { segmentRepo } from '@/storage/repositories/segmentRepo'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Projects',
  '/settings': 'Settings',
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const label = pathname.startsWith('/project/')
    ? 'Translation Workspace'
    : ROUTE_LABELS[pathname] ?? pathname

  return (
    <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
      {label}
    </span>
  )
}

function ProjectProgress({ projectId }: { projectId: string }) {
  const counts = useLiveQuery(() => segmentRepo.countByStatus(projectId), [projectId])
  if (!counts) return null
  const total =
    counts.untranslated + counts.draft + counts.translated + counts.reviewed + counts.locked
  const done = counts.translated + counts.reviewed + counts.locked
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex items-center gap-2" data-testid="topbar-progress">
      <span className="text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
        {done} / {total}
      </span>
      <div
        className="h-1.5 w-24 rounded-full overflow-hidden"
        style={{ background: 'var(--color-border)' }}
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
        />
      </div>
    </div>
  )
}

function ActiveProjectId(): string | null {
  const { pathname } = useLocation()
  const match = matchPath('/project/:id', pathname)
  return match?.params.id ?? null
}

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const projectId = ActiveProjectId()

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0 border-b"
      style={{
        height: 'var(--topbar-height)',
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="text-sm font-semibold tracking-widest"
        style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}
      >
        VERBALIS
      </span>

      <div className="flex items-center gap-4">
        <Breadcrumb />
        {projectId && <ProjectProgress projectId={projectId} />}
      </div>

      <button
        onClick={toggleTheme}
        className="p-1.5 rounded transition-colors"
        style={{ color: 'var(--color-muted)' }}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  )
}
