import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeft, Info, BookOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

interface SidebarLinkProps {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  collapsed: boolean
}

/** A single sidebar entry — one source of truth for the active-state styling
 * shared by the primary nav and the pinned Guide / About links. The active
 * background uses `--color-accent-subtle` so it adapts to the light theme
 * instead of hardcoding the dark-theme accent. */
function SidebarLink({ to, icon: Icon, label, end, collapsed }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors',
          isActive ? 'font-medium' : 'hover:opacity-80',
        )
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
      })}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export function Sidebar() {
  const { pathname } = useLocation()
  // Collapse automatically while inside a project editor so the translation
  // grid gets the full width; manual toggles override until the next time the
  // editor is (re)entered. `null` means "follow the auto behaviour".
  const inEditor = pathname.startsWith('/project/')
  const [manual, setManual] = useState<boolean | null>(null)
  const collapsed = manual ?? inEditor

  useEffect(() => {
    // Re-arm the automatic behaviour each time the editor is entered or left.
    setManual(null)
  }, [inEditor])

  const setCollapsed = (next: boolean | ((c: boolean) => boolean)) => {
    setManual((prev) => {
      const current = prev ?? inEditor
      return typeof next === 'function' ? next(current) : next
    })
  }

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 border-r transition-all duration-200"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ to, icon, label, end }) => (
          <SidebarLink key={to} to={to} icon={icon} label={label} end={end} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 px-2">
        <SidebarLink to="/guide" icon={BookOpen} label="Translation guide" collapsed={collapsed} />
        <SidebarLink to="/about" icon={Info} label="About & License" collapsed={collapsed} />
      </div>

      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-center p-2 m-2 rounded transition-colors"
        style={{ color: 'var(--color-muted)' }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </aside>
  )
}
