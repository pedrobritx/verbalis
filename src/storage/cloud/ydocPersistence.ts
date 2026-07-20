import type { SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { ORIGIN_REMOTE } from '@/storage/sync/segmentCrdt'
import { isCloudConfigured, getSupabase } from './supabaseClient'
import { encodeBytea, decodeBytea } from './bytea'

/**
 * Postgres persistence loop for a cloud project's Yjs doc (ROADMAP §4.3, D6).
 *
 * Realtime (§4.2) is the low-latency channel; Postgres is the source of truth.
 * This loop keeps the two honest:
 *
 *  - **Catch-up on open** — fetch the compacted `ydoc_state` snapshot plus the
 *    whole `ydoc_updates` log, apply the merge as `ORIGIN_REMOTE` (so neither the
 *    transport nor this loop re-broadcasts / re-appends it), and push anything the
 *    local doc holds that the cloud lacks (offline edits) back up. Yjs updates are
 *    idempotent, so re-running catch-up on reconnect converges by replay.
 *  - **Debounced append** — local edits are coalesced with `Y.mergeUpdates` and
 *    appended as one `ydoc_updates` row (attributed server-side via
 *    `author_id = auth.uid()`). A failed append re-buffers and retries.
 *  - **Optimistic compaction** — once the log grows past a threshold, re-read the
 *    authoritative snapshot + updates, fold them into a fresh snapshot, and
 *    install it via the `claim_compaction` RPC. The RPC's `seq` guard means only
 *    one racing compactor wins; the loser simply drops its attempt.
 *
 * Strictly additive (D6): no `@supabase/supabase-js` loads until a signed-in user
 * opens a cloud project (`getSupabase()` is dynamic); the pure data functions
 * take an injected client so vitest never touches a real backend.
 */

/** Default debounce before a burst of local edits is appended as one row. */
const APPEND_DEBOUNCE_MS = 500
/** Compact once the update log exceeds this many rows (ROADMAP §4.3: >200). */
const COMPACT_THRESHOLD = 200

// ---------------------------------------------------------------------------
// Pure data layer (client injected)
// ---------------------------------------------------------------------------

/** The compacted snapshot bytes + its compaction generation (`seq`). */
export interface SnapshotRow {
  state: Uint8Array | null
  seq: number
}

/** Fetch the current snapshot + seq for a project (nulls when unseeded). */
export async function fetchSnapshot(
  client: SupabaseClient,
  cloudId: string,
): Promise<SnapshotRow> {
  const { data, error } = await client
    .from('ydoc_state')
    .select('state,seq')
    .eq('project_id', cloudId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as { state: string | null; seq: number | string } | null
  if (!row) return { state: null, seq: 0 }
  return { state: row.state ? decodeBytea(row.state) : null, seq: Number(row.seq) }
}

/** One decoded append-log row. */
export interface UpdateRow {
  id: number
  bytes: Uint8Array
}

/** Fetch the whole append log for a project, ordered oldest-first. */
export async function fetchUpdates(
  client: SupabaseClient,
  cloudId: string,
): Promise<UpdateRow[]> {
  const { data, error } = await client
    .from('ydoc_updates')
    .select('id,update')
    .eq('project_id', cloudId)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data as { id: number | string; update: string }[] | null) ?? []).map((r) => ({
    id: Number(r.id),
    bytes: decodeBytea(r.update),
  }))
}

/** Append one (already-merged) Yjs update to the log; author is server-stamped. */
export async function appendUpdate(
  client: SupabaseClient,
  cloudId: string,
  bytes: Uint8Array,
): Promise<void> {
  const { error } = await client
    .from('ydoc_updates')
    .insert({ project_id: cloudId, update: encodeBytea(bytes) })
  if (error) throw new Error(error.message)
}

/** How many rows the append log currently holds (head-only count query). */
export async function countUpdates(client: SupabaseClient, cloudId: string): Promise<number> {
  const { count, error } = await client
    .from('ydoc_updates')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', cloudId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Optimistically install a compacted snapshot: bumps `seq` from `expectedSeq`,
 * writes `state`, and prunes updates with `id <= upToId` — all atomically in the
 * RPC. Returns the new seq, or null when another compactor won the race.
 */
export async function claimCompaction(
  client: SupabaseClient,
  cloudId: string,
  expectedSeq: number,
  state: Uint8Array,
  upToId: number,
): Promise<number | null> {
  const { data, error } = await client.rpc('claim_compaction', {
    p_project_id: cloudId,
    p_expected_seq: expectedSeq,
    p_state: encodeBytea(state),
    p_up_to_id: upToId,
  })
  if (error) throw new Error(error.message)
  return data === null || data === undefined ? null : Number(data)
}

// ---------------------------------------------------------------------------
// Pure Yjs helpers
// ---------------------------------------------------------------------------

/** Merge a snapshot + ordered updates into one update, or null when empty. */
function mergeRemote(snapshot: Uint8Array | null, updates: UpdateRow[]): Uint8Array | null {
  const parts: Uint8Array[] = []
  if (snapshot) parts.push(snapshot)
  for (const u of updates) parts.push(u.bytes)
  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0] : Y.mergeUpdates(parts)
}

/** True when the local doc holds structs the remote state vector is missing. */
function localAheadOf(doc: Y.Doc, remoteSV: Uint8Array): boolean {
  const local = Y.decodeStateVector(Y.encodeStateVector(doc))
  const remote = Y.decodeStateVector(remoteSV)
  for (const [client, clock] of local) {
    if ((remote.get(client) ?? 0) < clock) return true
  }
  return false
}

const EMPTY_STATE_VECTOR = Y.encodeStateVector(new Y.Doc())

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export interface YdocPersistenceHandle {
  /** Reconcile the local doc with Postgres (safe to re-run on reconnect). */
  catchUp(): Promise<void>
  /** Force-flush any pending appended edits now (used by tests). */
  flush(): Promise<void>
  /** Detach the doc listener and stop the loop. */
  destroy(): void
}

export interface YdocPersistenceOptions {
  cloudId: string
  doc: Y.Doc
  client: SupabaseClient
  debounceMs?: number
  compactThreshold?: number
}

/**
 * Create the persistence loop for a doc with an injected client (the unit-test
 * seam). Attaches the local-update listener immediately; callers drive the first
 * {@link YdocPersistenceHandle.catchUp}.
 */
export function createYdocPersistence(opts: YdocPersistenceOptions): YdocPersistenceHandle {
  const { doc, client, cloudId } = opts
  const debounceMs = opts.debounceMs ?? APPEND_DEBOUNCE_MS
  const compactThreshold = opts.compactThreshold ?? COMPACT_THRESHOLD

  let buffer: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  const scheduleFlush = () => {
    if (destroyed || timer !== null) return
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, debounceMs)
  }

  const flush = async (): Promise<void> => {
    if (destroyed || buffer.length === 0) return
    const merged = buffer.length === 1 ? buffer[0] : Y.mergeUpdates(buffer)
    buffer = []
    try {
      await appendUpdate(client, cloudId, merged)
      await maybeCompact()
    } catch {
      // Offline / transient: re-buffer and retry on the next tick. Postgres is
      // truth, so nothing is lost — the edit is still in the local doc + Dexie.
      if (!destroyed) {
        buffer.unshift(merged)
        scheduleFlush()
      }
    }
  }

  const maybeCompact = async (): Promise<void> => {
    if (destroyed) return
    if ((await countUpdates(client, cloudId)) <= compactThreshold) return
    // Re-read the authoritative state so the new snapshot subsumes exactly the
    // rows we prune — never trust the local doc, which may lag a peer's append.
    const snap = await fetchSnapshot(client, cloudId)
    const updates = await fetchUpdates(client, cloudId)
    if (updates.length <= compactThreshold) return // a peer compacted meanwhile
    const merged = mergeRemote(snap.state, updates)
    if (!merged) return
    const cdoc = new Y.Doc({ gc: true })
    Y.applyUpdate(cdoc, merged)
    const newState = Y.encodeStateAsUpdate(cdoc)
    cdoc.destroy()
    // A null result means a peer compacted first — the log is already bounded,
    // so there is nothing to retry.
    await claimCompaction(client, cloudId, snap.seq, newState, updates[updates.length - 1].id)
  }

  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (destroyed || origin === ORIGIN_REMOTE) return
    buffer.push(update)
    scheduleFlush()
  }
  doc.on('update', onLocalUpdate)

  const catchUp = async (): Promise<void> => {
    if (destroyed) return
    const snap = await fetchSnapshot(client, cloudId)
    const updates = await fetchUpdates(client, cloudId)
    const merged = mergeRemote(snap.state, updates)

    let remoteSV = EMPTY_STATE_VECTOR
    if (merged) {
      remoteSV = Y.encodeStateVectorFromUpdate(merged)
      Y.applyUpdate(doc, merged, ORIGIN_REMOTE)
    }

    // Anything the local doc has that the cloud lacks (offline edits, or the
    // pre-publish history) is pushed up so every member converges through
    // Postgres. Empty when the cloud is already ahead-or-equal.
    if (localAheadOf(doc, remoteSV)) {
      await appendUpdate(client, cloudId, Y.encodeStateAsUpdate(doc, remoteSV))
    }
  }

  return {
    catchUp,
    flush,
    destroy() {
      if (destroyed) return
      destroyed = true
      doc.off('update', onLocalUpdate)
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      buffer = []
    },
  }
}

// ---------------------------------------------------------------------------
// Wiring: resolve the real client and start the loop for a cloud project.
// ---------------------------------------------------------------------------

/**
 * Start the persistence loop for a signed-in cloud project. Loads the Supabase
 * client dynamically (so local-only builds never pull it) and returns null when
 * the cloud is unconfigured. The caller drives the first `catchUp`.
 */
export async function startYdocPersistence(
  cloudId: string,
  doc: Y.Doc,
): Promise<YdocPersistenceHandle | null> {
  if (!isCloudConfigured()) return null
  const client = await getSupabase()
  return createYdocPersistence({ cloudId, doc, client })
}
