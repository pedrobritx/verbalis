import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TMPanel } from './tm/TMPanel'
import { GlossaryPanel } from './glossary/GlossaryPanel'
import { MTPanel } from './mt/MTPanel'
import { QAPanel } from './qa/QAPanel'
import { SpellPanel } from './spell/SpellPanel'
import { ChangesPanel } from './changes/ChangesPanel'
import { VersionHistoryPanel } from './history/VersionHistoryPanel'
import { PeersPanel } from './peers/PeersPanel'
import { useSidebarPanelStore, type SidebarTab } from './useSidebarPanelStore'
import { useEditorModeStore } from './useEditorModeStore'
import { STAGE_TABS } from './stageConfig'

interface SidebarPanelProps {
  focusedSource: string | undefined
  focusedTarget: string | undefined
  focusedSegmentId: string | undefined
  projectId: string
  sourceLang: string
  targetLang: string
  onApplyTM: (target: string) => void
  onInsertGlossary: (text: string) => void
  onApplyMT: (target: string) => void
}

const TAB_LABELS: Record<SidebarTab, string> = {
  tm: 'TM',
  glossary: 'Glossary',
  mt: 'MT',
  qa: 'QA',
  spell: 'Spell',
  changes: 'Changes',
  history: 'History',
  peers: 'Peers',
}

export function SidebarPanel({
  focusedSource,
  focusedTarget,
  focusedSegmentId,
  projectId,
  sourceLang,
  targetLang,
  onApplyTM,
  onInsertGlossary,
  onApplyMT,
}: SidebarPanelProps) {
  const tab = useSidebarPanelStore((s) => s.tab)
  const setTab = useSidebarPanelStore((s) => s.setTab)
  const setOpen = useSidebarPanelStore((s) => s.setOpen)
  const stage = useEditorModeStore((s) => s.stage)

  const tabs = STAGE_TABS[stage]
  // Peers is valid even though it isn't in any stage strip (opened via the header
  // chip). Otherwise, if the stored tab doesn't belong to this stage yet — e.g. a
  // frame before EditorPage's stage effect resets it — fall back to the first tab
  // so the panel never renders content from another stage.
  const activeTab: SidebarTab = tabs.includes(tab) || tab === 'peers' ? tab : tabs[0]

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
          {tabs.map((id) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                data-testid={`sidebar-tab-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  'text-xs px-2 py-1 rounded transition-colors',
                  isActive ? 'font-semibold' : 'hover:opacity-80',
                )}
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {TAB_LABELS[id]}
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

      {activeTab === 'tm' && (
        <div data-testid="tm-panel">
          <TMPanel
            focusedSource={focusedSource}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onApply={onApplyTM}
          />
        </div>
      )}
      {activeTab === 'glossary' && (
        <div data-testid="glossary-panel">
          <GlossaryPanel
            focusedSource={focusedSource}
            projectId={projectId}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onInsert={onInsertGlossary}
          />
        </div>
      )}
      {activeTab === 'mt' && (
        <div data-testid="mt-panel">
          <MTPanel
            focusedSource={focusedSource}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onApply={onApplyMT}
          />
        </div>
      )}
      {activeTab === 'qa' && (
        <div data-testid="qa-panel">
          <QAPanel projectId={projectId} targetLang={targetLang} />
        </div>
      )}
      {activeTab === 'spell' && (
        <div data-testid="spell-panel">
          <SpellPanel
            targetLang={targetLang}
            focusedTarget={focusedTarget}
            focusedSegmentId={focusedSegmentId}
          />
        </div>
      )}
      {activeTab === 'changes' && (
        <div data-testid="changes-panel">
          <ChangesPanel projectId={projectId} />
        </div>
      )}
      {activeTab === 'history' && (
        <div data-testid="history-panel">
          <VersionHistoryPanel projectId={projectId} />
        </div>
      )}
      {activeTab === 'peers' && <PeersPanel projectId={projectId} />}
    </aside>
  )
}
