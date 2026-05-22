import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/providers'
import { useLocation } from 'react-router-dom'

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

export function TopBar() {
  const { theme, toggleTheme } = useTheme()

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

      <Breadcrumb />

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
