import { useRef } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileTabBar } from './MobileTabBar'
import { useCollapsingTopBar } from './useCollapsingTopBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null)
  const collapsed = useCollapsingTopBar(mainRef)

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar collapsed={collapsed} />
        <main
          ref={mainRef}
          className="flex-1 overflow-auto p-4 md:p-6 pb-[calc(theme(spacing.16)+env(safe-area-inset-bottom))] md:pb-6"
        >
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  )
}
