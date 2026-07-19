import { create } from 'zustand'

/** How the document preview shows content. */
export type PreviewMode = 'source' | 'target' | 'split'

interface PreviewState {
  open: boolean
  mode: PreviewMode
  toggle: () => void
  setOpen: (open: boolean) => void
  setMode: (mode: PreviewMode) => void
}

/** UI state for the live document preview pane (Phase 2.3). */
export const usePreviewStore = create<PreviewState>((set) => ({
  open: false,
  mode: 'target',
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  setMode: (mode) => set({ mode }),
}))
