import { isTauri } from '../platform'
import { BroadcastChannelTransport } from './broadcastChannel'
import { TauriLanTransport } from './tauri'
import { SupabaseRealtimeTransport } from './supabaseRealtime'
import type { SyncTransport } from './types'

export type { SyncTransport, SyncMessage, SyncMessageHandler, PeerId } from './types'

/**
 * Pick the right transport (Foundation F3, ROADMAP §4.2): the Supabase Realtime
 * transport for a signed-in cloud project (caller passes its `cloudId`), else
 * the Tauri LAN transport on the desktop shell, else the same-machine
 * BroadcastChannel transport in the browser. All implement {@link SyncTransport},
 * so callers stay transport-agnostic. The BroadcastChannel/LAN paths are
 * unchanged — the cloud branch is additive and only taken when `cloudId` is set.
 */
export function createTransport(projectId: string, opts?: { cloudId?: string }): SyncTransport {
  if (opts?.cloudId) return new SupabaseRealtimeTransport(opts.cloudId)
  return isTauri()
    ? new TauriLanTransport(projectId)
    : new BroadcastChannelTransport(projectId)
}
