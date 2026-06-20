import { isTauri } from '../platform'
import { BroadcastChannelTransport } from './broadcastChannel'
import { TauriLanTransport } from './tauri'
import type { SyncTransport } from './types'

export type { SyncTransport, SyncMessage, SyncMessageHandler, PeerId } from './types'

/**
 * Pick the right transport for the current platform (Foundation F3): the Tauri
 * LAN transport on the desktop shell, the same-machine BroadcastChannel
 * transport in the browser. Both implement {@link SyncTransport}, so callers are
 * platform-agnostic.
 */
export function createTransport(projectId: string): SyncTransport {
  return isTauri()
    ? new TauriLanTransport(projectId)
    : new BroadcastChannelTransport(projectId)
}
