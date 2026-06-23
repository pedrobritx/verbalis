import type { SidebarTab } from './useSidebarPanelStore'
import type { EditorStage } from './useEditorModeStore'

/**
 * Single source of truth for how the three workflow stages map onto the editor's
 * tools. Shared by the sidebar (which tabs to show), EditorPage (the default tab a
 * stage opens on) and the command palette (cross-stage jumps), so the grouping
 * never drifts between them.
 *
 * Peers is intentionally absent from every stage — it's cross-cutting and reached
 * from the header presence chip, which sets `tab: 'peers'` directly.
 */
export const STAGE_TABS: Record<EditorStage, SidebarTab[]> = {
  prepare: ['tm', 'glossary'],
  translate: ['tm', 'glossary', 'mt'],
  revise: ['qa', 'spell', 'changes', 'history'],
}

/** Sidebar tab each stage opens on, so a phase lands on its primary panel. */
export const STAGE_DEFAULT_TAB: Record<EditorStage, SidebarTab> = {
  prepare: 'tm',
  translate: 'tm',
  revise: 'qa',
}

/**
 * The stage that surfaces a given sidebar tab, used when a command jumps straight
 * to a panel and must bring the matching stage with it. TM/glossary/MT resolve to
 * Translate (their most common home); review panels resolve to Revise.
 */
export function stageForTab(tab: SidebarTab): EditorStage {
  if (STAGE_TABS.translate.includes(tab)) return 'translate'
  if (STAGE_TABS.revise.includes(tab)) return 'revise'
  return 'prepare'
}
