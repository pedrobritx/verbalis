import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TMPanel } from './tm/TMPanel'
import { GlossaryPanel } from './glossary/GlossaryPanel'
import { useSidebarPanelStore, type SidebarTab } from './useSidebarPanelStore'

interface SidebarPanelProps {
  focusedSource: string | undefined
  projectId: string
  sourceLang: string
  targetLang: string
  onApplyTM: (target: string) => void
  onInsertGlossary: (text: string) => void
}

const TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: 'tm', label: 'TM' },
  { id: 'glossary', label: 'Glossary' },
]

export function SidebarPanel({
  focusedSource,
  projectId,
  sourceLang,
  targetLang,
  onApplyTM,
  onInsertGlossary,
}: SidebarPanelProps) {
  const tab = useSidebarPanelStore((s) => s.tab)
  const setTab = useSidebarPanelStore((s) => s.setTab)
  const setOpen = useSidebarPanelStore((s) => s.setOpen)

  return (
    <aside
      data-testid="sidebar-panel"
      className="flex flex-col gap-3 rounded-md border p-3 h-fit sticky top-0"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between">
        <div
          role="tablist"
          aria-label="Sidebar panel"
          className="flex items-center gap-1 rounded-md border p-0.5"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {TABS.map((t) => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                data-testid={`sidebar-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  'text-xs px-2 py-1 rounded transition-colors',
                  isActive ? 'font-semibold' : 'hover:opacity-80',
                )}
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
          className="p-1 rounded transition-colors hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
          data-testid="sidebar-close"
        >
          <X size={14} />
        </button>
      </div>

      {tab === 'tm' && (
        <div data-testid="tm-panel">
          <TMPanel
            focusedSource={focusedSource}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onApply={onApplyTM}
          />
        </div>
      )}
      {tab === 'glossary' && (
        <div data-testid="glossary-panel">
          <GlossaryPanel
            focusedSource={focusedSource}
            projectId={projectId}
            targetLang={targetLang}
            onInsert={onInsertGlossary}
          />
        </div>
      )}
    </aside>
  )
}
