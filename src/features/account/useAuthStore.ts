import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { isCloudConfigured, getSupabase } from '@/storage/cloud/supabaseClient'

/**
 * Account/auth state for the signed-in mode (ROADMAP §3 D6/D7). Strictly
 * additive: when the cloud is not configured the store parks in `unconfigured`
 * and never loads `@supabase/supabase-js`, so 100%-local behaviour is
 * byte-identical to the pre-accounts app.
 */

export type AuthStatus = 'unconfigured' | 'loading' | 'authenticated' | 'unauthenticated'

/** Minimal user shape the UI needs — decoupled from the Supabase User type. */
export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

/** OAuth providers Supabase Auth exposes that we surface as "Continue with". */
export type OAuthProvider = 'google' | 'azure' | 'apple'

/** One sign-in method linked to the account, shown in Account settings (3.2). */
export interface LinkedIdentity {
  /** Stable per-identity id (used only as a React key). */
  id: string
  /** Supabase provider id: `google` | `azure` | `apple` | `email` | … */
  provider: string
  /** Email associated with this identity, when the provider exposes one. */
  email: string | null
  /** ISO timestamp the identity was linked, when available. */
  createdAt: string | null
}

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** Editable account display name from the `profiles` row (null until loaded). */
  profileDisplayName: string | null
  /** Sign-in methods linked to the account (null until loaded). */
  identities: LinkedIdentity[] | null
  /** Last auth error, surfaced in the sign-in dialog. */
  error: string | null
  /** Set after a magic-link email is dispatched, to show the "check inbox" note. */
  magicLinkSentTo: string | null
  init: () => Promise<void>
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  /** Load the profile row + linked identities for the signed-in user (3.2). */
  loadAccount: () => Promise<void>
  /** Persist a new account display name to the `profiles` row (3.2). */
  updateDisplayName: (name: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null
  return { id: user.id, email: user.email ?? null, displayName, avatarUrl }
}

/**
 * Where the OAuth / magic-link redirect lands. We return to the app's origin +
 * path (never the `#/route`): the provider appends `?code=` *before* the hash,
 * which `authBootstrap` exchanges and strips before the router mounts (D7).
 */
function authRedirectTo(): string {
  return window.location.origin + window.location.pathname
}

/** Shape of a Supabase `UserIdentity` — narrowed to the fields the UI reads. */
interface SupabaseIdentity {
  identity_id?: string
  id?: string
  provider: string
  identity_data?: { email?: string } | null
  created_at?: string
}

function toLinkedIdentity(identity: SupabaseIdentity): LinkedIdentity {
  return {
    id: identity.identity_id ?? identity.id ?? identity.provider,
    provider: identity.provider,
    email: identity.identity_data?.email ?? null,
    createdAt: identity.created_at ?? null,
  }
}

// Guard so init() only ever subscribes once, even under StrictMode double-mount.
let initStarted = false

export const useAuthStore = create<AuthState>((set, get) => ({
  status: isCloudConfigured() ? 'loading' : 'unconfigured',
  user: null,
  profileDisplayName: null,
  identities: null,
  error: null,
  magicLinkSentTo: null,

  init: async () => {
    if (!isCloudConfigured() || initStarted) return
    initStarted = true
    try {
      const supabase = await getSupabase()
      const { data } = await supabase.auth.getSession()
      set({
        user: toAuthUser(data.session?.user ?? null),
        status: data.session ? 'authenticated' : 'unauthenticated',
      })
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          user: toAuthUser(session?.user ?? null),
          status: session ? 'authenticated' : 'unauthenticated',
          // Clear per-account state when the session ends; it reloads on demand.
          ...(session ? {} : { profileDisplayName: null, identities: null }),
        })
      })
    } catch {
      set({ status: 'unauthenticated' })
    }
  },

  loadAccount: async () => {
    if (!isCloudConfigured()) return
    const user = get().user
    if (!user) return
    try {
      const supabase = await getSupabase()
      const [profileResult, identityResult] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        supabase.auth.getUserIdentities(),
      ])
      const displayName = (profileResult.data?.display_name as string | null | undefined) ?? null
      const rawIdentities = (identityResult.data?.identities ?? []) as SupabaseIdentity[]
      set((s) => ({
        profileDisplayName: displayName,
        identities: rawIdentities.map(toLinkedIdentity),
        // Prefer the account's own display name in the top-bar menu once known.
        user: s.user && displayName ? { ...s.user, displayName } : s.user,
      }))
    } catch {
      // Non-fatal: leave whatever state we had; the settings UI still renders.
    }
  },

  updateDisplayName: async (name) => {
    const user = get().user
    if (!user) return
    const trimmed = name.trim()
    const value = trimmed || null
    set({ error: null })
    try {
      const supabase = await getSupabase()
      const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: value })
      if (error) {
        set({ error: error.message })
        return
      }
      set((s) => ({
        profileDisplayName: value,
        // Reflect the change in the avatar/menu immediately; fall back to the
        // provider name when the field is cleared.
        user: s.user ? { ...s.user, displayName: value ?? s.user.displayName } : s.user,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not save your name.' })
    }
  },

  signInWithOAuth: async (provider) => {
    set({ error: null })
    try {
      const supabase = await getSupabase()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authRedirectTo() },
      })
      // On success the browser navigates away; an error means we never left.
      if (error) set({ error: error.message })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Sign-in failed.' })
    }
  },

  signInWithMagicLink: async (email) => {
    set({ error: null, magicLinkSentTo: null })
    try {
      const supabase = await getSupabase()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirectTo() },
      })
      if (error) set({ error: error.message })
      else set({ magicLinkSentTo: email })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not send the link.' })
    }
  },

  signOut: async () => {
    try {
      const supabase = await getSupabase()
      await supabase.auth.signOut()
    } catch {
      // Fall through: onAuthStateChange (or the next reload) reconciles state.
    }
    set({
      user: null,
      status: 'unauthenticated',
      magicLinkSentTo: null,
      profileDisplayName: null,
      identities: null,
    })
  },

  clearError: () => set({ error: null }),
}))
