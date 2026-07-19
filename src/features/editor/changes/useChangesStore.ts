import { create } from 'zustand'

/**
 * View toggles for tracked changes.
 * - `showDiff` colours the version-diff view in the Changes panel's History tab.
 * - `showMarks` toggles the in-editor tracked-change / comment decorations (a
 *   CSS class on the segment list); off shows the clean proposed text.
 */
interface ChangesState {
  showDiff: boolean
  toggle: () => void
  showMarks: boolean
  toggleMarks: () => void
}

export const useChangesStore = create<ChangesState>((set) => ({
  showDiff: true,
  toggle: () => set((s) => ({ showDiff: !s.showDiff })),
  showMarks: true,
  toggleMarks: () => set((s) => ({ showMarks: !s.showMarks })),
}))
