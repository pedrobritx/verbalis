import { Moon, Sun, Command as CommandIcon, Languages } from 'lucide-react'
import { useTheme } from '@/app/providers'
import { Link, useLocation, matchPath } from 'react-router-dom'
import { VerbalisMark } from '@/components/brand/VerbalisMark'
import { useLiveQuery } from 'dexie-react-hooks'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { useCommandPaletteStore } from '@/features/command-palette/useCommandPaletteStore'
import { useQuickLookupStore } from '@/features/lookup/useQuickLookupStore'
import { AccountMenu } from '@/features/account/AccountMenu'
import { OfflineBadge } from './OfflineBadge'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Projects',
  '/translate': 'Translate',
  '/tm': 'Translation Memory',
  '/terminology': 'Glossary',
  '/corpora': 'Corpora',
  '/addons': 'Add-ons',
  '/guide': 'Translation guide',
  '/settings': 'Settings',
  '/about': 'About & License',
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

interface TopBarProps {
  collapsed?: boolean
}

export function TopBar({ collapsed = false }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()
  const projectId = ActiveProjectId()
  const openPalette = useCommandPaletteStore((s) => s.setOpen)
  const openLookup = useQuickLookupStore((s) => s.openWith)

  return (
    <header
      className="flex items-center justify-between px-3 md:px-4 shrink-0 border-b transition-transform duration-200"
      style={{
        height: 'var(--topbar-height)',
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        paddingTop: 'env(safe-area-inset-top)',
        transform: collapsed ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <Link
        to="/about"
        className="flex items-center gap-2 rounded transition-opacity hover:opacity-80"
        aria-label="Verbalis — about, license & credits"
      >
        <VerbalisMark size={20} />
        <span
          className="text-sm font-semibold tracking-widest"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}
        >
          VERBALIS
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-4">
        <Breadcrumb />
        {projectId && <ProjectProgress projectId={projectId} />}
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        <OfflineBadge />
        <button
          onClick={() => openLookup()}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-muted)' }}
          aria-label="Quick lookup"
          data-testid="open-quick-lookup"
        >
          <Languages size={16} />
        </button>
        <button
          onClick={() => openPalette(true)}
          className="hidden md:inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-muted)',
            background: 'transparent',
          }}
          aria-label="Open command palette"
          data-testid="open-command-palette"
        >
          <CommandIcon size={12} />
          <kbd className="text-[10px] opacity-80">K</kbd>
        </button>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-muted)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <AccountMenu />
      </div>
    </header>
  )
}
