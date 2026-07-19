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

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** Last auth error, surfaced in the sign-in dialog. */
  error: string | null
  /** Set after a magic-link email is dispatched, to show the "check inbox" note. */
  magicLinkSentTo: string | null
  init: () => Promise<void>
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
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

// Guard so init() only ever subscribes once, even under StrictMode double-mount.
let initStarted = false

export const useAuthStore = create<AuthState>((set) => ({
  status: isCloudConfigured() ? 'loading' : 'unconfigured',
  user: null,
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
        })
      })
    } catch {
      set({ status: 'unauthenticated' })
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
    set({ user: null, status: 'unauthenticated', magicLinkSentTo: null })
  },

  clearError: () => set({ error: null }),
}))
