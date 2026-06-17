import { create } from 'zustand'

interface AddTermState {
  open: boolean
  /** Text the dialog should pre-fill the term field with (current selection). */
  initialTerm: string
  openWith: (term: string) => void
  setOpen: (open: boolean) => void
}

export const useAddTermStore = create<AddTermState>((set) => ({
  open: false,
  initialTerm: '',
  openWith: (term) => set({ open: true, initialTerm: term }),
  setOpen: (open) => set({ open }),
}))
