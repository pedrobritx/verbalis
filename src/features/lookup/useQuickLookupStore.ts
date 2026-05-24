import { create } from 'zustand'

interface QuickLookupState {
  open: boolean
  prefill: string
  openWith: (prefill?: string) => void
  close: () => void
}

export const useQuickLookupStore = create<QuickLookupState>((set) => ({
  open: false,
  prefill: '',
  openWith: (prefill = '') => set({ open: true, prefill }),
  close: () => set({ open: false, prefill: '' }),
}))
