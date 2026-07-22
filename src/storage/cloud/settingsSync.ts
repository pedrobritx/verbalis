import type { SupabaseClient } from '@supabase/supabase-js'
import {
  settingsRepo,
  subscribeSettingsChange,
  EDITOR_SETTINGS_KEY,
  LOOKUP_SETTINGS_KEY,
  SPELL_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'
import { isCloudConfigured, getSupabase } from './supabaseClient'
import { useAuthStore } from '@/features/account/useAuthStore'

/**
 * Cloud settings sync (ROADMAP §3.3, D6). A background reconciler over the
 * `user_settings` table: pull-on-sign-in + push-on-change, per-key
 * last-write-wins. Dexie stays the read path — the UI never waits on the
 * network; this only mirrors an allowlist of keys in the background.
 *
 * **Allowlist, not everything.** Only durable preferences sync. MT provider
 * settings are excluded on purpose (they hold API keys — D6/§3.3), as are the
 * web-search providers (same reason), the device-local author identity
 * (`profile.identity`), and the semantic-TM model choice (device-specific).
 * Sidebar *layout* sync is a tracked follow-up (Phase 3.3.1) — it lives in a
 * separate localStorage store without LWW timestamps.
 *
 * Strictly additive: nothing here loads `@supabase/supabase-js` until a signed-in
 * session actually reconciles (`getSupabase()` is dynamic), and the whole module
 * is imported only when the cloud is configured.
 */
export const SYNCED_SETTINGS_KEYS = [
  EDITOR_SETTINGS_KEY,
  LOOKUP_SETTINGS_KEY,
  SPELL_SETTINGS_KEY,
] as const

const SYNCED_KEY_SET = new Set<string>(SYNCED_SETTINGS_KEYS)

/** The remote table name; kept in one place so tests and code agree. */
export const USER_SETTINGS_TABLE = 'user_settings'

/** A local settings row reduced to what reconciliation needs. */
export interface SettingsEntry {
  key: string
  value: unknown
  /** Epoch-ms; 0 for rows written before 3.3 (treated as oldest). */
  updatedAt: number
}

/** What a reconciliation decided: values to write locally vs. push to the cloud. */
export interface Reconciliation {
  pull: SettingsEntry[]
  push: SettingsEntry[]
}

/**
 * Pure per-key last-write-wins over the allowlist. Newer `updatedAt` wins;
 * present-on-one-side flows to the other; equal timestamps are left untouched.
 * Keys outside the allowlist are ignored entirely (defence in depth — the
 * caller already scopes its queries).
 */
export function reconcileSettings(
  local: SettingsEntry[],
  remote: SettingsEntry[],
  keys: readonly string[] = SYNCED_SETTINGS_KEYS,
): Reconciliation {
  const allow = new Set(keys)
  const localByKey = new Map(local.filter((e) => allow.has(e.key)).map((e) => [e.key, e]))
  const remoteByKey = new Map(remote.filter((e) => allow.has(e.key)).map((e) => [e.key, e]))

  const pull: SettingsEntry[] = []
  const push: SettingsEntry[] = []

  for (const key of allow) {
    const l = localByKey.get(key)
    const r = remoteByKey.get(key)
    if (l && r) {
      if (r.updatedAt > l.updatedAt) pull.push(r)
      else if (l.updatedAt > r.updatedAt) push.push(l)
      // equal → in sync, nothing to do
    } else if (r && !l) {
      pull.push(r)
    } else if (l && !r) {
      push.push(l)
    }
  }

  return { pull, push }
}

/** Read the allowlisted settings rows from Dexie as reconciliation entries. */
export async function readLocalSyncedEntries(): Promise<SettingsEntry[]> {
  const entries: SettingsEntry[] = []
  for (const key of SYNCED_SETTINGS_KEYS) {
    const row = await settingsRepo.getRow(key)
    if (row !== undefined) {
      entries.push({ key, value: row.value, updatedAt: row.updatedAt ?? 0 })
    }
  }
  return entries
}

/** Parse a Postgres `timestamptz` string to epoch-ms (0 when unparseable). */
function toEpoch(ts: string | null | undefined): number {
  if (!ts) return 0
  const n = Date.parse(ts)
  return Number.isNaN(n) ? 0 : n
}

interface RemoteRow {
  key: string
  value: unknown
  updated_at: string
}

/** Fetch this user's allowlisted rows from the cloud as reconciliation entries. */
async function fetchRemoteEntries(
  client: SupabaseClient,
  userId: string,
): Promise<SettingsEntry[]> {
  const { data, error } = await client
    .from(USER_SETTINGS_TABLE)
    .select('key,value,updated_at')
    .eq('user_id', userId)
    .in('key', SYNCED_SETTINGS_KEYS as unknown as string[])
  if (error) throw new Error(error.message)
  return ((data as RemoteRow[] | null) ?? []).map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: toEpoch(r.updated_at),
  }))
}

/** Upsert one entry to the cloud, carrying its local timestamp for LWW. */
async function pushEntry(
  client: SupabaseClient,
  userId: string,
  entry: SettingsEntry,
): Promise<void> {
  const { error } = await client.from(USER_SETTINGS_TABLE).upsert({
    user_id: userId,
    key: entry.key,
    value: entry.value,
    updated_at: new Date(entry.updatedAt || Date.now()).toISOString(),
  })
  if (error) throw new Error(error.message)
}

/**
 * Full reconcile for a signed-in user: pull newer remote values into Dexie and
 * push newer local values up. Injectable client keeps vitest off the network.
 */
export async function pullAndReconcile(client: SupabaseClient, userId: string): Promise<void> {
  const [remote, local] = await Promise.all([
    fetchRemoteEntries(client, userId),
    readLocalSyncedEntries(),
  ])
  const { pull, push } = reconcileSettings(local, remote)
  // Apply remote-wins locally without re-notifying (no echo back out).
  for (const entry of pull) {
    await settingsRepo.applyRemote(entry.key, entry.value, entry.updatedAt)
  }
  // Push local-wins up.
  for (const entry of push) {
    await pushEntry(client, userId, entry)
  }
}

/** Push a single allowlisted key's current local value to the cloud. */
export async function pushKey(client: SupabaseClient, userId: string, key: string): Promise<void> {
  if (!SYNCED_KEY_SET.has(key)) return
  const row = await settingsRepo.getRow(key)
  if (row === undefined) return
  await pushEntry(client, userId, { key, value: row.value, updatedAt: row.updatedAt ?? Date.now() })
}

// ---------------------------------------------------------------------------
// Wiring: pull once per authenticated user, push allowlisted local changes.
// ---------------------------------------------------------------------------

let started = false
let unsubscribeAuth: (() => void) | null = null
let unsubscribeSettings: (() => void) | null = null
/** The user id we've already pulled for, so token refreshes don't re-pull. */
let pulledFor: string | null = null
const pendingPush = new Set<string>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
const PUSH_DEBOUNCE_MS = 500

function currentUserId(): string | null {
  const s = useAuthStore.getState()
  return s.status === 'authenticated' ? (s.user?.id ?? null) : null
}

async function runPull(userId: string): Promise<void> {
  try {
    const client = await getSupabase()
    await pullAndReconcile(client, userId)
  } catch {
    // Non-fatal: local Dexie stays authoritative; retried on the next sign-in.
  }
}

function schedulePush(key: string): void {
  if (!SYNCED_KEY_SET.has(key)) return
  if (currentUserId() === null) return
  pendingPush.add(key)
  if (pushTimer !== null) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    void flushPush()
  }, PUSH_DEBOUNCE_MS)
}

async function flushPush(): Promise<void> {
  const userId = currentUserId()
  if (userId === null) {
    pendingPush.clear()
    return
  }
  const keys = [...pendingPush]
  pendingPush.clear()
  try {
    const client = await getSupabase()
    for (const key of keys) await pushKey(client, userId, key)
  } catch {
    // Dropped this round; a later change (or next sign-in pull) reconciles.
  }
}

/**
 * Start the background reconciler. Idempotent and a no-op when the cloud is
 * unconfigured. Pulls immediately if a session is already present, pulls again
 * on each new sign-in, and pushes allowlisted local edits (debounced).
 */
export function startSettingsSync(): void {
  if (started || !isCloudConfigured()) return
  started = true

  const maybePull = () => {
    const userId = currentUserId()
    if (userId && userId !== pulledFor) {
      pulledFor = userId
      void runPull(userId)
    } else if (userId === null) {
      pulledFor = null
    }
  }

  unsubscribeAuth = useAuthStore.subscribe(maybePull)
  unsubscribeSettings = subscribeSettingsChange(schedulePush)
  // Handle the case where init() already resolved to a session before we mounted.
  maybePull()
}

/** Tear down subscriptions (tests / hot-reload). */
export function stopSettingsSync(): void {
  unsubscribeAuth?.()
  unsubscribeSettings?.()
  unsubscribeAuth = null
  unsubscribeSettings = null
  if (pushTimer !== null) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  pendingPush.clear()
  pulledFor = null
  started = false
}
