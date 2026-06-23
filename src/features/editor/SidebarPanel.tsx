import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  Settings2,
  RotateCcw,
  Database,
  BookMarked,
  Languages,
  Search,
  ShieldCheck,
  SpellCheck,
  GitCompare,
  History as HistoryIcon,
  Users,
} from 'lucide-react'
import { TMPanel } from './tm/TMPanel'
import { GlossaryPanel } from './glossary/GlossaryPanel'
import { MTPanel } from './mt/MTPanel'
import { LookupPanel } from './lookup/LookupPanel'
import { QAPanel } from './qa/QAPanel'
import { SpellPanel } from './spell/SpellPanel'
import { ChangesPanel } from './changes/ChangesPanel'
import { VersionHistoryPanel } from './history/VersionHistoryPanel'
import { PeersPanel } from './peers/PeersPanel'
import { useSidebarPanelStore, type SidebarTab } from './useSidebarPanelStore'
import { useEditorModeStore } from './useEditorModeStore'
import { ALL_TABS, TAB_LABELS } from './stageConfig'

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

const TAB_ICONS: Record<SidebarTab, ReactNode> = {
  tm: <Database size={13} />,
  glossary: <BookMarked size={13} />,
  mt: <Languages size={13} />,
  lookup: <Search size={13} />,
  qa: <ShieldCheck size={13} />,
  spell: <SpellCheck size={13} />,
  changes: <GitCompare size={13} />,
  history: <HistoryIcon size={13} />,
  peers: <Users size={13} />,
}

/** A collapsible, removable panel container in the stacked sidebar. */
function SidebarSection({
  tab,
  removable = true,
  children,
}: {
  tab: SidebarTab
  removable?: boolean
  children: ReactNode
}) {
  const collapsed = useSidebarPanelStore((s) => !!s.collapsed[tab])
  const toggleCollapsed = useSidebarPanelStore((s) => s.toggleCollapsed)
  const togglePanel = useSidebarPanelStore((s) => s.togglePanel)
  const stage = useEditorModeStore((s) => s.stage)

  return (
    <section
      data-testid={`sidebar-section-${tab}`}
      className="rounded-md border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 border-b"
        style={{ borderColor: collapsed ? 'transparent' : 'var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => toggleCollapsed(tab)}
          aria-expanded={!collapsed}
          data-testid={`sidebar-collapse-${tab}`}
          className="flex flex-1 items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text)' }}
        >
          <span style={{ color: 'var(--color-muted)' }}>{TAB_ICONS[tab]}</span>
          <span>{TAB_LABELS[tab]}</span>
          <span className="ml-auto" style={{ color: 'var(--color-muted)' }}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </button>
        {removable && (
          <button
            type="button"
            onClick={() => togglePanel(stage, tab)}
            aria-label={`Remove ${TAB_LABELS[tab]} panel`}
            title={`Remove ${TAB_LABELS[tab]}`}
            data-testid={`sidebar-remove-${tab}`}
            className="p-0.5 rounded transition-colors hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {!collapsed && <div className="p-3">{children}</div>}
    </section>
  )
}

/** Popover that lets the translator add/remove/reorder panels for the active stage. */
function SidebarCustomizer() {
  const stage = useEditorModeStore((s) => s.stage)
  const layout = useSidebarPanelStore((s) => s.layout[stage])
  const togglePanel = useSidebarPanelStore((s) => s.togglePanel)
  const movePanel = useSidebarPanelStore((s) => s.movePanel)
  const resetLayout = useSidebarPanelStore((s) => s.resetLayout)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Customize tools"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Customize tools"
        data-testid="sidebar-customize"
        className="p-1 rounded transition-colors hover:opacity-70"
        style={{ color: 'var(--color-muted)' }}
      >
        <Settings2 size={15} />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="sidebar-customize-menu"
          className="absolute right-0 z-30 mt-1 w-56 rounded-md border p-1.5 shadow-md"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div
            className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            Tools in this stage
          </div>
          {/* Active tools, in the exact order they render in the sidebar, so
              reordering here moves the sections there identically. */}
          {layout.map((tab, idx) => (
            <div
              key={tab}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm"
              style={{ color: 'var(--color-text)' }}
            >
              <label className="flex flex-1 items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked
                  onChange={() => togglePanel(stage, tab)}
                  data-testid={`sidebar-customize-${tab}`}
                />
                <span className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--color-muted)' }}>{TAB_ICONS[tab]}</span>
                  {TAB_LABELS[tab]}
                </span>
              </label>
              <span className="flex items-center">
                <button
                  type="button"
                  onClick={() => movePanel(stage, tab, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${TAB_LABELS[tab]} up`}
                  data-testid={`sidebar-moveup-${tab}`}
                  className="p-0.5 rounded transition-colors hover:opacity-70 disabled:opacity-30"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => movePanel(stage, tab, 1)}
                  disabled={idx === layout.length - 1}
                  aria-label={`Move ${TAB_LABELS[tab]} down`}
                  data-testid={`sidebar-movedown-${tab}`}
                  className="p-0.5 rounded transition-colors hover:opacity-70 disabled:opacity-30"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <ChevronDown size={13} />
                </button>
              </span>
            </div>
          ))}

          {ALL_TABS.some((t) => !layout.includes(t)) && (
            <div
              className="px-1.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Add tools
            </div>
          )}
          {ALL_TABS.filter((t) => !layout.includes(t)).map((tab) => (
            <label
              key={tab}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-sm cursor-pointer"
              style={{ color: 'var(--color-text)' }}
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => togglePanel(stage, tab)}
                data-testid={`sidebar-customize-${tab}`}
              />
              <span className="flex items-center gap-1.5">
                <span style={{ color: 'var(--color-muted)' }}>{TAB_ICONS[tab]}</span>
                {TAB_LABELS[tab]}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              resetLayout(stage)
              setOpen(false)
            }}
            data-testid="sidebar-customize-reset"
            className="mt-1 flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-xs transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-muted)' }}
          >
            <RotateCcw size={13} />
            Reset to default
          </button>
        </div>
      )}
    </div>
  )
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
  const setOpen = useSidebarPanelStore((s) => s.setOpen)
  const stage = useEditorModeStore((s) => s.stage)
  const layout = useSidebarPanelStore((s) => s.layout[stage])

  const renderPanel = (t: SidebarTab): ReactNode => {
    switch (t) {
      case 'tm':
        return (
          <TMPanel
            focusedSource={focusedSource}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onApply={onApplyTM}
          />
        )
      case 'glossary':
        return (
          <GlossaryPanel
            focusedSource={focusedSource}
            projectId={projectId}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onInsert={onInsertGlossary}
          />
        )
      case 'mt':
        return (
          <MTPanel
            focusedSource={focusedSource}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onApply={onApplyMT}
          />
        )
      case 'lookup':
        return <LookupPanel sourceLang={sourceLang} targetLang={targetLang} projectId={projectId} />
      case 'qa':
        return <QAPanel projectId={projectId} targetLang={targetLang} />
      case 'spell':
        return (
          <SpellPanel
            targetLang={targetLang}
            focusedTarget={focusedTarget}
            focusedSegmentId={focusedSegmentId}
          />
        )
      case 'changes':
        return <ChangesPanel projectId={projectId} />
      case 'history':
        return <VersionHistoryPanel projectId={projectId} />
      case 'peers':
        return <PeersPanel projectId={projectId} />
      default:
        return null
    }
  }

  // Peers is cross-cutting: it has no slot in any stage layout, so show it on top
  // only while it's the active target (opened from the header presence chip).
  const showPeers = tab === 'peers' && !layout.includes('peers')

  return (
    <aside
      data-testid="sidebar-panel"
      className="flex flex-col gap-2 rounded-md border p-2 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="flex items-center justify-between px-1 py-0.5 sticky top-0 z-10"
        style={{ background: 'var(--color-surface)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Tools
        </span>
        <div className="flex items-center gap-0.5">
          <SidebarCustomizer />
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
      </div>

      {showPeers && (
        <div data-testid="peers-panel">
          <SidebarSection tab="peers" removable={false}>
            {renderPanel('peers')}
          </SidebarSection>
        </div>
      )}

      {layout.length === 0 && !showPeers && (
        <p
          className="px-1 py-3 text-xs"
          style={{ color: 'var(--color-muted)' }}
          data-testid="sidebar-empty"
        >
          No tools in this stage. Use the gear to add some.
        </p>
      )}

      {layout.map((t) => (
        <div key={t} data-testid={`${t}-panel`}>
          <SidebarSection tab={t}>{renderPanel(t)}</SidebarSection>
        </div>
      ))}
    </aside>
  )
}
