import type { SupabaseClient } from '@supabase/supabase-js'
import { db, type SyncResource } from '@/storage/db'
import type { GlossaryEntry, TMEntry } from '@/core/types'
import { settingsRepo } from '@/storage/repositories/settingsRepo'
import { isCloudConfigured, getSupabase } from './supabaseClient'
import {
  setRowSyncEnabled,
  subscribeResourceChange,
} from './rowSyncState'
import { useAuthStore } from '@/features/account/useAuthStore'

/**
 * Personal term-bank + TM cloud sync (ROADMAP §3.4, D6). A generic cursor-based
 * incremental row reconciler with per-row last-write-wins and soft-delete
 * tombstones, driving two resources (glossary, personal TM) through one engine.
 *
 * Model: each cloud row is `{ id, user_id, updated_at, deleted, payload }`. A
 * pull fetches rows changed since the per-resource cursor and applies them under
 * LWW (a newer remote wins; a newer local is kept and re-pushed). A delete is a
 * soft-delete upsert (`deleted = true`), so deletions propagate and never
 * resurrect. Bundled corpora never sync — corpus-seeded TM rows carry a
 * `corpusId` and are filtered out; the term bank is entirely user-authored.
 *
 * Strictly additive: no `@supabase/supabase-js` loads until a signed-in session
 * reconciles (`getSupabase()` is dynamic), and the module is imported only when
 * the cloud is configured. Dexie stays the read path — applied rows land in the
 * local tables, which the glossary/TM UI already observes via `useLiveQuery`.
 */

/** One cloud row in the generic sync envelope. */
interface RemoteRow {
  id: string
  updated_at: string
  deleted: boolean
  payload: unknown
}

/** Bridges the generic engine to a concrete Dexie table. */
interface RowSyncAdapter<T extends { id: string; updatedAt?: number }> {
  resource: SyncResource
  table: string
  cursorKey: string
  /** Personal rows changed since the cursor (excludes bundled corpora). */
  localChangedSince(cursor: number): Promise<T[]>
  /** The local row's LWW timestamp, or undefined when the row is absent. */
  localUpdatedAt(id: string): Promise<number | undefined>
  /** Apply a remote row locally (raw — no restamp / tombstone / notify). */
  localPut(row: T): Promise<void>
  /** Apply a remote delete locally, clearing any pending tombstone for it. */
  localDelete(id: string): Promise<void>
}

const glossaryAdapter: RowSyncAdapter<GlossaryEntry> = {
  resource: 'glossary',
  table: 'personal_glossary',
  cursorKey: 'sync.cursor.glossary',
  localChangedSince: (cursor) => db.glossary.where('updatedAt').above(cursor).toArray(),
  localUpdatedAt: async (id) => (await db.glossary.get(id))?.updatedAt,
  localPut: async (row) => {
    await db.glossary.put(row)
  },
  localDelete: async (id) => {
    await db.glossary.delete(id)
    await db.syncTombstones.delete(['glossary', id])
  },
}

const tmAdapter: RowSyncAdapter<TMEntry> = {
  resource: 'tm',
  table: 'personal_tm',
  cursorKey: 'sync.cursor.tm',
  // Corpus-seeded rows carry a corpusId and never sync.
  localChangedSince: async (cursor) =>
    (await db.tm.where('updatedAt').above(cursor).toArray()).filter((r) => !r.corpusId),
  localUpdatedAt: async (id) => (await db.tm.get(id))?.updatedAt,
  localPut: async (row) => {
    await db.tm.put(row)
  },
  localDelete: async (id) => {
    await db.tm.delete(id)
    await db.syncTombstones.delete(['tm', id])
  },
}

function toEpoch(ts: string): number {
  const n = Date.parse(ts)
  return Number.isNaN(n) ? 0 : n
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

async function getCursor(key: string): Promise<number> {
  return (await settingsRepo.get<number>(key)) ?? 0
}

/**
 * Push locally-changed rows and tombstones to the cloud. Tombstones are cleared
 * only after a successful upsert, so a failed push retries the delete next time.
 */
export async function pushResource<T extends { id: string; updatedAt?: number }>(
  client: SupabaseClient,
  userId: string,
  adapter: RowSyncAdapter<T>,
  cursor: number,
): Promise<void> {
  const changed = await adapter.localChangedSince(cursor)
  const upserts = changed.map((row) => ({
    id: row.id,
    user_id: userId,
    updated_at: toIso(row.updatedAt ?? Date.now()),
    deleted: false,
    payload: row,
  }))

  const tombstones = await db.syncTombstones.where('resource').equals(adapter.resource).toArray()
  for (const t of tombstones) {
    upserts.push({
      id: t.rowId,
      user_id: userId,
      updated_at: toIso(t.deletedAt),
      deleted: true,
      payload: {} as T,
    })
  }

  if (upserts.length > 0) {
    const { error } = await client.from(adapter.table).upsert(upserts)
    if (error) throw new Error(error.message)
  }
  if (tombstones.length > 0) {
    await db.syncTombstones.bulkDelete(tombstones.map((t) => [t.resource, t.rowId]))
  }
}

/**
 * Pull rows changed since the cursor and apply them under LWW. Returns the new
 * cursor (the max remote `updated_at` seen, never below the old cursor).
 */
export async function pullResource<T extends { id: string; updatedAt?: number }>(
  client: SupabaseClient,
  userId: string,
  adapter: RowSyncAdapter<T>,
  cursor: number,
): Promise<number> {
  const { data, error } = await client
    .from(adapter.table)
    .select('id,updated_at,deleted,payload')
    .eq('user_id', userId)
    .gt('updated_at', toIso(cursor))
    .order('updated_at', { ascending: true })
  if (error) throw new Error(error.message)

  let next = cursor
  for (const row of (data as RemoteRow[] | null) ?? []) {
    const ts = toEpoch(row.updated_at)
    if (ts > next) next = ts
    const localTs = await adapter.localUpdatedAt(row.id)
    // Local same-or-newer wins (also skips our own just-pushed rows).
    if (localTs !== undefined && localTs >= ts) continue
    if (row.deleted) {
      await adapter.localDelete(row.id)
    } else {
      await adapter.localPut({ ...(row.payload as T), id: row.id, updatedAt: ts })
    }
  }
  return next
}

/** Push then pull one resource, advancing its stored cursor. */
export async function syncResource<T extends { id: string; updatedAt?: number }>(
  client: SupabaseClient,
  userId: string,
  adapter: RowSyncAdapter<T>,
): Promise<void> {
  const cursor = await getCursor(adapter.cursorKey)
  await pushResource(client, userId, adapter, cursor)
  const next = await pullResource(client, userId, adapter, cursor)
  if (next > cursor) await settingsRepo.set(adapter.cursorKey, next)
}

/** Reconcile every personal resource for a signed-in user. */
export async function syncAllResources(client: SupabaseClient, userId: string): Promise<void> {
  await syncResource(client, userId, glossaryAdapter)
  await syncResource(client, userId, tmAdapter)
}

// ---------------------------------------------------------------------------
// Wiring: sync on sign-in, and debounced after local term-bank / TM changes.
// ---------------------------------------------------------------------------

let started = false
let inFlight = false
let unsubscribeAuth: (() => void) | null = null
let unsubscribeResource: (() => void) | null = null
let pulledFor: string | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 800

function currentUserId(): string | null {
  const s = useAuthStore.getState()
  return s.status === 'authenticated' ? (s.user?.id ?? null) : null
}

async function runSync(): Promise<void> {
  const userId = currentUserId()
  if (userId === null || inFlight) return
  inFlight = true
  try {
    const client = await getSupabase()
    await syncAllResources(client, userId)
  } catch {
    // Non-fatal: Dexie stays authoritative; retried on next change / sign-in.
  } finally {
    inFlight = false
  }
}

function scheduleSync(): void {
  if (currentUserId() === null) return
  if (syncTimer !== null) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    void runSync()
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Start the personal-resource sync. Idempotent; a no-op when the cloud is
 * unconfigured. Enables tombstone recording + a full reconcile on each new
 * sign-in, and a debounced push/pull after local glossary or TM edits.
 */
export function startRowSync(): void {
  if (started || !isCloudConfigured()) return
  started = true

  const onAuth = () => {
    const userId = currentUserId()
    if (userId) {
      setRowSyncEnabled(true)
      if (userId !== pulledFor) {
        pulledFor = userId
        void runSync()
      }
    } else {
      setRowSyncEnabled(false)
      pulledFor = null
    }
  }

  unsubscribeAuth = useAuthStore.subscribe(onAuth)
  unsubscribeResource = subscribeResourceChange(scheduleSync)
  onAuth()
}

/** Tear down subscriptions (tests / hot-reload). */
export function stopRowSync(): void {
  unsubscribeAuth?.()
  unsubscribeResource?.()
  unsubscribeAuth = null
  unsubscribeResource = null
  if (syncTimer !== null) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  setRowSyncEnabled(false)
  pulledFor = null
  inFlight = false
  started = false
}
