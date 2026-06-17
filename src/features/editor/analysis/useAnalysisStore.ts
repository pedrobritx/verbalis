import { create } from 'zustand'

interface AnalysisState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
