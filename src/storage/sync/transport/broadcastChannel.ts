import type { SyncMessage, SyncMessageHandler, SyncTransport } from './types'

/**
 * Same-machine, cross-tab transport over the browser `BroadcastChannel`
 * (Foundation F3). Every tab that opens the same shared project joins the
 * channel `verbalis-sync-<projectId>` and exchanges {@link SyncMessage}s.
 *
 * `BroadcastChannel` structured-clones the message, so the `Uint8Array` payloads
 * survive intact with no serialization on our side. A channel never delivers a
 * message back to the sender, so there is no self-echo to filter.
 *
 * This is the zero-dependency transport that makes live collaboration testable
 * in the PWA today; the Tauri transport implements the same interface for real
 * cross-machine LAN sync.
 */
export class BroadcastChannelTransport implements SyncTransport {
  private channel: BroadcastChannel | null = null
  private handler: SyncMessageHandler | null = null

  constructor(private readonly projectId: string) {}

  start(): void {
    if (this.channel) return
    this.channel = new BroadcastChannel(`verbalis-sync-${this.projectId}`)
    this.channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
      this.handler?.(ev.data)
    }
  }

  send(msg: SyncMessage): void {
    this.channel?.postMessage(msg)
  }

  onMessage(handler: SyncMessageHandler): void {
    this.handler = handler
  }

  destroy(): void {
    if (!this.channel) return
    this.channel.onmessage = null
    this.channel.close()
    this.channel = null
    this.handler = null
  }
}
