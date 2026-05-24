import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

export function MobileTabBar() {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex border-t backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
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
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-hit pt-1.5 pb-1 text-[10px] transition-colors',
              isActive ? 'font-semibold' : 'font-normal',
            )
          }
          style={({ isActive }) => ({
            color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
          })}
        >
          <Icon size={24} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
