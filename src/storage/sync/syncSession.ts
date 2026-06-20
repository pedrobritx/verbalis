import * as Y from 'yjs'
import { ORIGIN_REMOTE } from './segmentCrdt'
import { installReverseBridge } from './reverseBridge'
import {
  PresenceTracker,
  PRESENCE_HEARTBEAT_MS,
  type PeerPresence,
  type PresenceWire,
} from './presence'
import { identityCodec, type PayloadCodec } from './crypto'
import type { PeerId, SyncMessage, SyncTransport } from './transport/types'

/**
 * A live collaboration session for one project (Foundation F3).
 *
 * Binds a project's Yjs doc to a {@link SyncTransport}: local edits are
 * broadcast to peers, remote edits are applied (and reconciled into Dexie by the
 * reverse bridge), and presence is exchanged on a heartbeat. The session is the
 * single owner of the wiring, so `docManager` can start/stop it cleanly when a
 * project is shared/unshared.
 */

export interface SyncSessionHandle {
  /** The local peer's id (stable for the session's lifetime). */
  readonly peerId: PeerId
  /** Update which segment the local user is on; broadcasts presence. */
  setActiveSegment(id: string | undefined): void
  /** Current remote peers. */
  getPeers(): PeerPresence[]
  /** Subscribe to roster changes; returns an unsubscribe. */
  subscribe(cb: (peers: PeerPresence[]) => void): () => void
  /** Tear down: announce departure, detach observers, close the transport. */
  destroy(): void
}

export interface SyncSessionOptions {
  projectId: string
  doc: Y.Doc
  displayName: string
  transport: SyncTransport
  /** Payload codec (encryption). Defaults to identity (same-machine). */
  codec?: PayloadCodec
}

const textEnc = new TextEncoder()
const textDec = new TextDecoder()

export function startSyncSession(opts: SyncSessionOptions): SyncSessionHandle {
  const { projectId, doc, transport } = opts
  const codec = opts.codec ?? identityCodec
  const peerId: PeerId = crypto.randomUUID()
  const presence = new PresenceTracker(peerId)
  const subscribers = new Set<(peers: PeerPresence[]) => void>()

  let displayName = opts.displayName
  let activeSegmentId: string | undefined
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let destroyed = false

  const detachReverse = installReverseBridge(doc, projectId)

  const notify = () => {
    const peers = presence.list()
    for (const cb of subscribers) cb(peers)
  }

  const sendUpdate = (kind: 'update' | 'state', payload: Uint8Array) => {
    void codec.encode(payload).then((wire) => {
      if (!destroyed) transport.send({ kind, from: peerId, payload: wire })
    })
  }

  const sendPresence = () => {
    const wire: PresenceWire = { peerId, displayName, activeSegmentId }
    void codec.encode(textEnc.encode(JSON.stringify(wire))).then((payload) => {
      if (!destroyed) transport.send({ kind: 'presence', from: peerId, payload })
    })
  }

  const sendState = () => {
    sendUpdate('state', Y.encodeStateAsUpdate(doc))
  }

  // Broadcast local doc changes; never re-broadcast what a peer just sent us.
  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_REMOTE) return
    sendUpdate('update', update)
  }
  doc.on('update', onDocUpdate)

  const applyRemote = (payload: Uint8Array) => {
    void codec.decode(payload).then((update) => {
      if (!destroyed) Y.applyUpdate(doc, update, ORIGIN_REMOTE)
    })
  }

  const onMessage = (msg: SyncMessage) => {
    if (msg.from === peerId) return
    switch (msg.kind) {
      case 'hello':
      case 'state-request':
        // A peer just joined — hand them our state and announce ourselves.
        sendState()
        sendPresence()
        break
      case 'state':
      case 'update':
        applyRemote(msg.payload)
        break
      case 'presence':
        void codec.decode(msg.payload).then((bytes) => {
          if (destroyed) return
          presence.upsert(JSON.parse(textDec.decode(bytes)) as PresenceWire)
          notify()
        })
        break
      case 'bye':
        presence.remove(msg.from)
        notify()
        break
    }
  }

  transport.onMessage(onMessage)
  transport.start()
  // Announce arrival + ask existing peers for their state.
  transport.send({ kind: 'hello', from: peerId })
  transport.send({ kind: 'state-request', from: peerId })
  sendPresence()

  heartbeat = setInterval(() => {
    sendPresence()
    notify() // re-runs prune so stale peers drop out of the UI
  }, PRESENCE_HEARTBEAT_MS)

  return {
    peerId,
    setActiveSegment(id) {
      if (id === activeSegmentId) return
      activeSegmentId = id
      sendPresence()
    },
    getPeers: () => presence.list(),
    subscribe(cb) {
      subscribers.add(cb)
      cb(presence.list())
      return () => subscribers.delete(cb)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (heartbeat) clearInterval(heartbeat)
      doc.off('update', onDocUpdate)
      detachReverse()
      transport.send({ kind: 'bye', from: peerId })
      transport.destroy()
      subscribers.clear()
    },
  }
}
