import { create } from 'zustand'

/** Show/hide toggle for the tracked-changes diff colouring in the Changes panel. */
interface ChangesState {
  showDiff: boolean
  toggle: () => void
}

export const useChangesStore = create<ChangesState>((set) => ({
  showDiff: true,
  toggle: () => set((s) => ({ showDiff: !s.showDiff })),
}))
