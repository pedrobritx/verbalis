import { db, type SyncResource } from '@/storage/db'

/**
 * Shared seam between the personal-resource repos (glossary, TM) and the cloud
 * row-sync engine (ROADMAP §3.4), kept in the storage layer so the repos never
 * import the sync engine (or anything in `features/`). It does two things:
 *
 *  1. Gates tombstone recording on being signed in — local-only deletes write no
 *     tombstones, so the local-only DB stays inert (no accumulation, no
 *     behaviour change).
 *  2. Fans out "a synced resource changed locally" so the engine can debounce a
 *     push without the repos knowing it exists.
 */

let syncEnabled = false

/** Toggled by the sync engine's auth subscription. */
export function setRowSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled
}

export function isRowSyncEnabled(): boolean {
  return syncEnabled
}

/**
 * Record that a personal row was deleted, so the sync can push a soft-delete.
 * A no-op when signed out — local-only deletes leave no tombstone behind.
 */
export async function recordTombstone(resource: SyncResource, rowId: string): Promise<void> {
  if (!syncEnabled) return
  await db.syncTombstones.put({ resource, rowId, deletedAt: Date.now() })
}

type ResourceChangeListener = (resource: SyncResource) => void
const listeners = new Set<ResourceChangeListener>()

export function subscribeResourceChange(listener: ResourceChangeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Repos call this after a local mutation to a synced resource. */
export function notifyResourceChange(resource: SyncResource): void {
  for (const listener of listeners) listener(resource)
}
