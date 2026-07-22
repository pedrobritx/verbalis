import type { SyncMessage, SyncMessageHandler, SyncTransport } from './types'

/**
 * LAN transport backed by the Tauri desktop shell (Foundation F3).
 *
 * The Rust sidecar (`src-tauri/`) does mDNS discovery of `_verbalis._tcp.local`
 * peers and runs the encrypted LAN socket; this class is the thin JS bridge to
 * it. It speaks the same {@link SyncMessage} shapes as the BroadcastChannel
 * transport, so nothing above the transport seam changes between PWA and desktop.
 *
 * The Tauri APIs are imported lazily through a computed specifier so the PWA
 * build neither bundles nor requires `@tauri-apps/api` — this file is inert in
 * the browser and only wakes up inside the desktop shell, where {@link isTauri}
 * has selected it. The Rust commands/events it targets are scaffolded but not
 * yet wired end-to-end; cross-machine networking lands in the follow-up that
 * builds the desktop pipeline.
 */

interface TauriCore {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
}
interface TauriEvent {
  listen<T>(event: string, cb: (e: { payload: T }) => void): Promise<() => void>
}

async function loadTauri(): Promise<{ core: TauriCore; event: TauriEvent }> {
  // Computed specifiers keep TS/Vite from resolving these at build time; they
  // exist only inside the desktop shell.
  const coreSpec = '@tauri-apps/api/core'
  const eventSpec = '@tauri-apps/api/event'
  const core = (await import(/* @vite-ignore */ coreSpec)) as TauriCore
  const event = (await import(/* @vite-ignore */ eventSpec)) as TauriEvent
  return { core, event }
}

export class TauriLanTransport implements SyncTransport {
  private handler: SyncMessageHandler | null = null
  private unlisten: (() => void) | null = null
  private core: TauriCore | null = null
  private started = false

  constructor(private readonly projectId: string) {}

  start(): void {
    if (this.started) return
    this.started = true
    void this.wire()
  }

  private async wire(): Promise<void> {
    const { core, event } = await loadTauri()
    this.core = core
    // Rust emits `verbalis://sync/<projectId>` for every inbound peer message.
    this.unlisten = await event.listen<SyncMessage>(`verbalis://sync/${this.projectId}`, (e) =>
      this.handler?.(e.payload),
    )
    await core.invoke('start_sharing', { projectId: this.projectId })
  }

  send(msg: SyncMessage): void {
    void this.core?.invoke('broadcast_sync_message', { projectId: this.projectId, message: msg })
  }

  onMessage(handler: SyncMessageHandler): void {
    this.handler = handler
  }

  destroy(): void {
    this.unlisten?.()
    this.unlisten = null
    void this.core?.invoke('stop_sharing', { projectId: this.projectId })
    this.core = null
    this.handler = null
    this.started = false
  }
}
