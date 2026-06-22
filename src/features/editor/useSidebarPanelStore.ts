import { create } from 'zustand'

export type SidebarTab = 'tm' | 'glossary' | 'mt' | 'qa' | 'spell' | 'history' | 'peers'

interface SidebarPanelState {
  open: boolean
  tab: SidebarTab
  toggle: () => void
  setOpen: (open: boolean) => void
  setTab: (tab: SidebarTab) => void
}

export const useSidebarPanelStore = create<SidebarPanelState>((set) => ({
  open: true,
  tab: 'tm',
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab }),
}))
