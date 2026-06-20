import { create } from 'zustand'
import type { PeerPresence } from '@/storage/sync/presence'

/**
 * Live collaboration state for the open project (Foundation F3), published by
 * {@link useProjectSync} (which owns the session at the editor level) and read by
 * the Peers panel. A store avoids threading peers/sharing props through the
 * sidebar, and keeps sync running whenever the project is shared — independent of
 * which sidebar tab happens to be open.
 */
interface PresenceState {
  shared: boolean
  peers: PeerPresence[]
  setShared: (shared: boolean) => void
  setPeers: (peers: PeerPresence[]) => void
  reset: () => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  shared: false,
  peers: [],
  setShared: (shared) => set({ shared }),
  setPeers: (peers) => set({ peers }),
  reset: () => set({ shared: false, peers: [] }),
}))
