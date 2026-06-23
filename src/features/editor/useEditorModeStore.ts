import { create } from 'zustand'
import type { SegmentStatus } from '@/core/types'

export type StatusFilter = 'all' | SegmentStatus

/**
 * The three workflow stages of a translation job, mirroring the conceptual modes
 * documented in `public/guide/workflow.md` (shared prep → Mode A translation →
 * Mode B revision). The stage is the single organising control for the editor:
 * it scopes the action toolbar and the sidebar tabs, and the `revise` stage owns
 * what used to be the standalone "Review" toggle.
 */
export type EditorStage = 'prepare' | 'translate' | 'revise'

/**
 * Status filter a stage snaps to on entry, so each phase opens on the segments it
 * cares about. Applied once per switch — the user can still override afterwards.
 */
const STAGE_STATUS_DEFAULTS: Record<EditorStage, StatusFilter> = {
  prepare: 'untranslated',
  translate: 'all',
  revise: 'translated',
}

interface EditorModeState {
  stage: EditorStage
  /** Derived mirror of `stage === 'revise'`, kept in state so existing consumers
   * (SegmentRow, command palette, the Ctrl+Shift+R shortcut) read it unchanged. */
  reviewMode: boolean
  statusFilter: StatusFilter
  setStage: (stage: EditorStage) => void
  toggleReviewMode: () => void
  setReviewMode: (on: boolean) => void
  setStatusFilter: (filter: StatusFilter) => void
}

export const useEditorModeStore = create<EditorModeState>((set, get) => ({
  stage: 'translate',
  reviewMode: false,
  statusFilter: 'all',
  setStage: (stage) =>
    set({
      stage,
      reviewMode: stage === 'revise',
      statusFilter: STAGE_STATUS_DEFAULTS[stage],
    }),
  // "Review mode" is now just the Revise stage; route the legacy toggles through
  // the stage so review keeps working from the command palette and shortcut.
  toggleReviewMode: () => get().setStage(get().stage === 'revise' ? 'translate' : 'revise'),
  setReviewMode: (on) => get().setStage(on ? 'revise' : 'translate'),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}))
