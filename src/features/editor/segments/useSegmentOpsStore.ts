import { create } from 'zustand'

interface SegmentOpsState {
  /** Id of the segment whose Split dialog is open, or null when closed. */
  splitId: string | null
  openSplit: (id: string) => void
  close: () => void
}

export const useSegmentOpsStore = create<SegmentOpsState>((set) => ({
  splitId: null,
  openSplit: (id) => set({ splitId: id }),
  close: () => set({ splitId: null }),
}))
