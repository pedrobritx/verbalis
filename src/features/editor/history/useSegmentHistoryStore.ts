import { create } from 'zustand'

interface SegmentHistoryState {
  /** Segment whose row-history dialog is open, or null when closed. */
  segmentId: string | null
  projectId: string | null
  open: (projectId: string, segmentId: string) => void
  close: () => void
}

export const useSegmentHistoryStore = create<SegmentHistoryState>((set) => ({
  segmentId: null,
  projectId: null,
  open: (projectId, segmentId) => set({ projectId, segmentId }),
  close: () => set({ segmentId: null, projectId: null }),
}))
