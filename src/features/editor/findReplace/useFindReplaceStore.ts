import { create } from 'zustand'

interface FindReplaceState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useFindReplaceStore = create<FindReplaceState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
