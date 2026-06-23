import type { SidebarTab } from './useSidebarPanelStore'
import type { EditorStage } from './useEditorModeStore'

/**
 * Single source of truth for how the three workflow stages map onto the editor's
 * tools. `STAGE_TABS` is the *default* per-stage panel layout the sidebar starts
 * from; users can then add/remove/reorder panels per stage (persisted), so this
 * only seeds the layout and the "Reset" action. Shared by the sidebar, EditorPage
 * and the command palette so the grouping never drifts between them.
 *
 * Peers is intentionally absent from every stage — it's cross-cutting and reached
 * from the header presence chip, which sets `tab: 'peers'` directly.
 */
export const STAGE_TABS: Record<EditorStage, SidebarTab[]> = {
  prepare: ['tm', 'glossary', 'lookup'],
  translate: ['tm', 'glossary', 'mt', 'lookup'],
  revise: ['qa', 'spell', 'changes', 'history'],
}

/** Sidebar tab each stage opens on, so a phase lands on its primary panel. */
export const STAGE_DEFAULT_TAB: Record<EditorStage, SidebarTab> = {
  prepare: 'tm',
  translate: 'tm',
  revise: 'qa',
}

/** Every customisable panel, in palette order (peers excluded — it's cross-cutting). */
export const ALL_TABS: SidebarTab[] = [
  'tm',
  'glossary',
  'mt',
  'lookup',
  'qa',
  'spell',
  'changes',
  'history',
]

/** Human labels for each panel, shared by the sidebar headers and the customiser. */
export const TAB_LABELS: Record<SidebarTab, string> = {
  tm: 'TM',
  glossary: 'Glossary',
  mt: 'MT',
  lookup: 'Lookup',
  qa: 'QA',
  spell: 'Spell',
  changes: 'Changes',
  history: 'History',
  peers: 'Peers',
}

/**
 * The stage that surfaces a given sidebar tab, used when a command jumps straight
 * to a panel and must bring the matching stage with it. TM/glossary/MT/lookup
 * resolve to Translate (their most common home); review panels resolve to Revise.
 */
export function stageForTab(tab: SidebarTab): EditorStage {
  if (STAGE_TABS.translate.includes(tab)) return 'translate'
  if (STAGE_TABS.revise.includes(tab)) return 'revise'
  return 'prepare'
}
