import { create } from 'zustand'

interface ConcordanceState {
  open: boolean
  /** Initial query (e.g. the current editor selection). */
  initialQuery: string
  openWith: (query: string) => void
  setOpen: (open: boolean) => void
}

export const useConcordanceStore = create<ConcordanceState>((set) => ({
  open: false,
  initialQuery: '',
  openWith: (query) => set({ open: true, initialQuery: query }),
  setOpen: (open) => set({ open }),
}))
