import { create } from 'zustand'

interface ImportDialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useImportDialogStore = create<ImportDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
