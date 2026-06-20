/**
 * Platform detection for the sync layer (Foundation F3).
 *
 * The same React app runs as the zero-install PWA *and* as the Tauri desktop
 * peer. Only the desktop shell can bind sockets and do mDNS, so the transport
 * factory branches on {@link isTauri}: desktop → native LAN transport, browser →
 * the same-machine BroadcastChannel transport. Keeping the check in one place
 * means the rest of the sync code is platform-agnostic.
 */

interface TauriWindow {
  __TAURI_INTERNALS__?: unknown
  __TAURI__?: unknown
}

/** True when running inside the Tauri desktop shell (vs. a plain browser). */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as TauriWindow
  return w.__TAURI_INTERNALS__ !== undefined || w.__TAURI__ !== undefined
}
