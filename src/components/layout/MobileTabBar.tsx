import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

export function MobileTabBar() {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex border-t"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Primary"
    >
      {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
              isActive ? 'font-semibold' : 'hover:opacity-80',
            )
          }
          style={({ isActive }) => ({
            color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
            background: isActive ? 'rgba(0,194,204,0.06)' : 'transparent',
          })}
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
