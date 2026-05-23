import { create } from 'zustand'

interface TMPanelState {
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

export const useTMPanelStore = create<TMPanelState>((set) => ({
  open: true,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}))
