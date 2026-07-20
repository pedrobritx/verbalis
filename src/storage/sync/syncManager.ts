import { acquireProjectDoc, releaseProjectDoc } from './docManager'
import { startSyncSession, type SyncSessionHandle } from './syncSession'
import { createTransport } from './transport'
import { codecForPassphrase, identityCodec, type PayloadCodec } from './crypto'
import { getProfileSettings } from '@/storage/repositories/settingsRepo'
import { shareRepo } from '@/storage/repositories/shareRepo'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { isCloudConfigured } from '@/storage/cloud/supabaseClient'
import { startYdocPersistence, type YdocPersistenceHandle } from '@/storage/cloud/ydocPersistence'
import { useAuthStore } from '@/features/account/useAuthStore'

/**
 * Owns the live {@link SyncSessionHandle} per shared project (Foundation F3).
 *
 * A session is started when a project is shared and stopped when it is unshared
 * or its editor closes. Sessions are ref-counted (like docs) so multiple
 * consumers can depend on one without double-destroying it. The manager resolves
 * identity, transport and encryption codec, keeping React components unaware of
 * the wiring.
 */

interface ActiveSync {
  handle: SyncSessionHandle
  /** Postgres persistence loop, present only for a signed-in cloud project. */
  persistence: YdocPersistenceHandle | null
  refs: number
}

const active = new Map<string, ActiveSync>()

/** Build the transport payload codec: AES for a passphrase, identity otherwise. */
async function resolveCodec(projectId: string): Promise<PayloadCodec> {
  const share = await shareRepo.get(projectId)
  if (share.passphrase) return codecForPassphrase(share.passphrase, projectId)
  return identityCodec
}

/** Start (or join) the sync session for a project. Ref-counted. */
export async function startProjectSync(projectId: string): Promise<SyncSessionHandle> {
  const existing = active.get(projectId)
  if (existing) {
    existing.refs += 1
    return existing.handle
  }

  const [doc, profile, codec, project] = await Promise.all([
    acquireProjectDoc(projectId),
    getProfileSettings(),
    resolveCodec(projectId),
    projectRepo.getById(projectId),
  ])

  // A signed-in cloud project syncs over Supabase Realtime; everything else
  // keeps the same-machine BroadcastChannel (or Tauri LAN) transport (§4.2).
  const signedIn = useAuthStore.getState().status === 'authenticated'
  const cloudId =
    signedIn && isCloudConfigured() && project?.cloud ? project.cloud.id : undefined

  const handle = startSyncSession({
    projectId,
    doc,
    displayName: profile.displayName || 'Anonymous',
    transport: createTransport(projectId, { cloudId }),
    codec,
  })

  // A signed-in cloud project also runs the Postgres persistence loop (§4.3):
  // Realtime is latency, Postgres is truth. Catch-up converges the doc with the
  // cloud on open; local edits are appended debounced. Additive — nothing loads
  // for local-only projects, and a catch-up failure (offline) never blocks edit.
  let persistence: YdocPersistenceHandle | null = null
  if (cloudId) {
    persistence = await startYdocPersistence(cloudId, doc)
    void persistence?.catchUp().catch(() => {
      // Non-fatal: Dexie + the local Yjs doc stay authoritative; a later
      // catch-up (reopen / reconnect, §4.4) reconciles via replay.
    })
  }

  active.set(projectId, { handle, persistence, refs: 1 })
  return handle
}

/** Release one reference; tears the session down when the last is gone. */
export function stopProjectSync(projectId: string): void {
  const entry = active.get(projectId)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs > 0) return
  entry.persistence?.destroy()
  entry.handle.destroy()
  releaseProjectDoc(projectId)
  active.delete(projectId)
}

/** The live session for a project, or null when it is not shared. */
export function peekProjectSync(projectId: string): SyncSessionHandle | null {
  return active.get(projectId)?.handle ?? null
}
