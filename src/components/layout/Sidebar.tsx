import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeft, Info, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

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
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors',
                isActive
                  ? 'font-medium'
                  : 'hover:opacity-80',
              )
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
              background: isActive ? 'rgba(0,194,204,0.08)' : 'transparent',
            })}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/guide"
        className="flex items-center gap-3 px-2 py-2 mx-2 rounded text-sm transition-colors hover:opacity-80"
        style={({ isActive }) => ({
          color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
          background: isActive ? 'rgba(0,194,204,0.08)' : 'transparent',
        })}
      >
        <BookOpen size={16} className="shrink-0" />
        {!collapsed && <span className="truncate">Translation guide</span>}
      </NavLink>

      <NavLink
        to="/about"
        className="flex items-center gap-3 px-2 py-2 mx-2 rounded text-sm transition-colors hover:opacity-80"
        style={({ isActive }) => ({
          color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
          background: isActive ? 'rgba(0,194,204,0.08)' : 'transparent',
        })}
      >
        <Info size={16} className="shrink-0" />
        {!collapsed && <span className="truncate">About & License</span>}
      </NavLink>

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
