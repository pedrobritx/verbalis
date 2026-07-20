import type { SupabaseClient } from '@supabase/supabase-js'
import { isCloudConfigured, getSupabase } from '@/storage/cloud/supabaseClient'
import { useAuthStore } from '@/features/account/useAuthStore'
import {
  useSidebarPanelStore,
  defaultLayout,
  type SidebarTab,
} from './useSidebarPanelStore'
import type { EditorStage } from './useEditorModeStore'

/**
 * Sidebar layout sync (ROADMAP §3.3.1). The layout lives in a zustand
 * `persist` store (localStorage), not Dexie, so it can't ride the Dexie-backed
 * settings reconciler from 3.3. Instead it syncs through the same
 * `user_settings` cloud table under one key, with the same client-supplied
 * last-write-wins, and rehydrates the live store on pull so the other device
 * reflects the change without a reload.
 *
 * Strictly additive: the module (and the auth store it reads) load only when the
 * cloud is configured, and no `@supabase/supabase-js` loads until a signed-in
 * session reconciles (`getSupabase()` is dynamic). The store's persisted
 * `updatedAt` field is inert for local-only users.
 */

/** The `user_settings.key` the layout is stored under (distinct from the 3.3 Dexie keys). */
export const LAYOUT_SETTINGS_KEY = 'sidebar.layout'

const USER_SETTINGS_TABLE = 'user_settings'

interface LayoutValue {
  layout: Record<EditorStage, SidebarTab[]>
  collapsed: Partial<Record<SidebarTab, boolean>>
}

/** True while we apply a pulled value, so the store subscription doesn't re-push it. */
let applyingRemote = false

function snapshot(): { value: LayoutValue; updatedAt: number } {
  const s = useSidebarPanelStore.getState()
  return { value: { layout: s.layout, collapsed: s.collapsed }, updatedAt: s.updatedAt }
}

function applyRemote(value: LayoutValue, updatedAt: number): void {
  applyingRemote = true
  try {
    useSidebarPanelStore.setState({
      // Backfill any stage a stale remote might miss so the store stays complete.
      layout: { ...defaultLayout(), ...(value.layout ?? {}) },
      collapsed: value.collapsed ?? {},
      updatedAt,
    })
  } finally {
    applyingRemote = false
  }
}

async function pushLayout(client: SupabaseClient, userId: string): Promise<void> {
  const { value, updatedAt } = snapshot()
  const { error } = await client.from(USER_SETTINGS_TABLE).upsert({
    user_id: userId,
    key: LAYOUT_SETTINGS_KEY,
    value,
    updated_at: new Date(updatedAt || Date.now()).toISOString(),
  })
  if (error) throw new Error(error.message)
}

/**
 * Reconcile the layout for a signed-in user: pull the cloud value and apply it
 * when it's newer, otherwise push the local layout up. Injectable client keeps
 * vitest off the network.
 */
export async function syncLayout(client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await client
    .from(USER_SETTINGS_TABLE)
    .select('value,updated_at')
    .eq('user_id', userId)
    .eq('key', LAYOUT_SETTINGS_KEY)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const remoteTs = data?.updated_at ? Date.parse(data.updated_at) : -1
  const localTs = snapshot().updatedAt
  if (remoteTs > localTs) {
    applyRemote(data!.value as LayoutValue, remoteTs)
  } else if (localTs > remoteTs) {
    await pushLayout(client, userId)
  }
}

// ---------------------------------------------------------------------------
// Wiring: reconcile on sign-in, debounced push after a local layout change.
// ---------------------------------------------------------------------------

let started = false
let unsubscribeAuth: (() => void) | null = null
let unsubscribeStore: (() => void) | null = null
let syncedFor: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
const PUSH_DEBOUNCE_MS = 600

function currentUserId(): string | null {
  const s = useAuthStore.getState()
  return s.status === 'authenticated' ? (s.user?.id ?? null) : null
}

async function runReconcile(userId: string): Promise<void> {
  try {
    const client = await getSupabase()
    await syncLayout(client, userId)
  } catch {
    // Non-fatal: the local layout stays authoritative; retried on next sign-in.
  }
}

function schedulePush(): void {
  if (currentUserId() === null) return
  if (pushTimer !== null) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    void flushPush()
  }, PUSH_DEBOUNCE_MS)
}

async function flushPush(): Promise<void> {
  const userId = currentUserId()
  if (userId === null) return
  try {
    const client = await getSupabase()
    await pushLayout(client, userId)
  } catch {
    // Dropped this round; a later change (or next sign-in reconcile) recovers.
  }
}

/**
 * Start the layout reconciler. Idempotent; a no-op when the cloud is
 * unconfigured. Reconciles on each new sign-in and pushes local layout edits
 * (debounced), ignoring changes it applied from a pull.
 */
export function startLayoutSync(): void {
  if (started || !isCloudConfigured()) return
  started = true

  const onAuth = () => {
    const userId = currentUserId()
    if (userId && userId !== syncedFor) {
      syncedFor = userId
      void runReconcile(userId)
    } else if (userId === null) {
      syncedFor = null
    }
  }

  unsubscribeAuth = useAuthStore.subscribe(onAuth)
  unsubscribeStore = useSidebarPanelStore.subscribe((state, prev) => {
    if (!applyingRemote && state.updatedAt !== prev.updatedAt) schedulePush()
  })
  onAuth()
}

/** Tear down subscriptions (tests / hot-reload). */
export function stopLayoutSync(): void {
  unsubscribeAuth?.()
  unsubscribeStore?.()
  unsubscribeAuth = null
  unsubscribeStore = null
  if (pushTimer !== null) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  syncedFor = null
  started = false
}
