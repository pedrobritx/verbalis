import { create } from 'zustand'

export type UpdateSWFn = (reloadPage?: boolean) => Promise<void>

interface PwaState {
  needRefresh: boolean
  offlineReady: boolean
  updateSW: UpdateSWFn | null
  dismissRefresh: () => void
  ackOfflineReady: () => void
}

export const usePwaStore = create<PwaState>((set) => ({
  needRefresh: false,
  offlineReady: false,
  updateSW: null,
  dismissRefresh: () => set({ needRefresh: false }),
  ackOfflineReady: () => set({ offlineReady: false }),
}))

export const OFFLINE_READY_ACK_KEY = 'verbalis.pwa.offlineReadyAck'

export function setNeedRefresh(value: boolean): void {
  if (value) {
    try {
      localStorage.removeItem(OFFLINE_READY_ACK_KEY)
    } catch {
      // localStorage may be unavailable in some embed contexts; safe to ignore.
    }
  }
  usePwaStore.setState({ needRefresh: value })
}

export function setOfflineReady(value: boolean): void {
  usePwaStore.setState({ offlineReady: value })
}

export function setUpdateSW(fn: UpdateSWFn): void {
  usePwaStore.setState({ updateSW: fn })
}
