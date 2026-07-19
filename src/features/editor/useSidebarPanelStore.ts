import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EditorStage } from './useEditorModeStore'
import { STAGE_TABS, stageForTab } from './stageConfig'

export type SidebarTab =
  | 'tm'
  | 'glossary'
  | 'mt'
  | 'lookup'
  | 'qa'
  | 'spell'
  | 'changes'
  | 'comments'
  | 'history'
  | 'peers'

function defaultLayout(): Record<EditorStage, SidebarTab[]> {
  return {
    prepare: [...STAGE_TABS.prepare],
    translate: [...STAGE_TABS.translate],
    revise: [...STAGE_TABS.revise],
  }
}

interface SidebarPanelState {
  open: boolean
  /**
   * Cross-cutting "active" pointer: which panel a command-palette jump or the
   * peers chip wants surfaced. With the multi-pane layout every panel in the
   * stage is visible at once, so this is mainly a scroll/highlight + peers seam.
   */
  tab: SidebarTab
  /** Ordered list of panels stacked in the sidebar, per workflow stage. */
  layout: Record<EditorStage, SidebarTab[]>
  /** Per-panel collapsed state, shared across stages. */
  collapsed: Partial<Record<SidebarTab, boolean>>
  toggle: () => void
  setOpen: (open: boolean) => void
  /**
   * Back-compat with the old single-tab API: ensure a panel is visible in its
   * home stage (adding + expanding it if missing) and mark it the active target.
   * `peers` is cross-cutting and rendered on demand, so it skips the layout.
   */
  setTab: (tab: SidebarTab) => void
  setLayout: (stage: EditorStage, tabs: SidebarTab[]) => void
  /** Ensure a panel is present in the given stage and expanded, and make it active. */
  showPanel: (stage: EditorStage, tab: SidebarTab) => void
  /** Add a panel to a stage's layout if absent, otherwise remove it. */
  togglePanel: (stage: EditorStage, tab: SidebarTab) => void
  toggleCollapsed: (tab: SidebarTab) => void
  /** Reorder a panel within a stage by one slot (-1 up, +1 down). */
  movePanel: (stage: EditorStage, tab: SidebarTab, dir: -1 | 1) => void
  /** Restore a stage's layout to the shipped default. */
  resetLayout: (stage: EditorStage) => void
}

export const useSidebarPanelStore = create<SidebarPanelState>()(
  persist(
    (set) => ({
      open: true,
      tab: 'tm',
      layout: defaultLayout(),
      collapsed: {},
      toggle: () => set((s) => ({ open: !s.open })),
      setOpen: (open) => set({ open }),
      setTab: (tab) =>
        set((s) => {
          if (tab === 'peers') return { tab }
          const stage = stageForTab(tab)
          const cur = s.layout[stage]
          const layout = cur.includes(tab) ? s.layout : { ...s.layout, [stage]: [...cur, tab] }
          return { tab, layout, collapsed: { ...s.collapsed, [tab]: false } }
        }),
      setLayout: (stage, tabs) => set((s) => ({ layout: { ...s.layout, [stage]: tabs } })),
      showPanel: (stage, tab) =>
        set((s) => {
          const cur = s.layout[stage]
          const layout = cur.includes(tab) ? s.layout : { ...s.layout, [stage]: [...cur, tab] }
          return { tab, layout, collapsed: { ...s.collapsed, [tab]: false } }
        }),
      togglePanel: (stage, tab) =>
        set((s) => {
          const cur = s.layout[stage]
          const next = cur.includes(tab) ? cur.filter((t) => t !== tab) : [...cur, tab]
          return { layout: { ...s.layout, [stage]: next } }
        }),
      toggleCollapsed: (tab) =>
        set((s) => ({ collapsed: { ...s.collapsed, [tab]: !s.collapsed[tab] } })),
      movePanel: (stage, tab, dir) =>
        set((s) => {
          const cur = [...s.layout[stage]]
          const i = cur.indexOf(tab)
          const j = i + dir
          if (i < 0 || j < 0 || j >= cur.length) return {}
          ;[cur[i], cur[j]] = [cur[j], cur[i]]
          return { layout: { ...s.layout, [stage]: cur } }
        }),
      resetLayout: (stage) =>
        set((s) => ({ layout: { ...s.layout, [stage]: [...STAGE_TABS[stage]] } })),
    }),
    {
      name: 'verbalis.sidebar.layout',
      // Only the user's customisation is durable; open/active-tab are transient.
      partialize: (s) => ({ layout: s.layout, collapsed: s.collapsed }),
      // Backfill any stage missing from an older persisted shape so newly shipped
      // panels (e.g. 'lookup') and stages always have a sane default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SidebarPanelState>
        return {
          ...current,
          ...p,
          layout: { ...defaultLayout(), ...(p.layout ?? {}) },
          collapsed: p.collapsed ?? {},
        }
      },
    },
  ),
)
