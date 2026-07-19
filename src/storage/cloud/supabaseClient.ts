import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazy, env-gated Supabase client (ROADMAP §3 D6/D7). The library is loaded via
 * dynamic `import()` only when the cloud is configured AND actually needed, so
 * local-only builds never pull `@supabase/supabase-js` into the initial graph
 * and signed-out behaviour is byte-identical to the pre-accounts app. The type
 * import above is erased at build time (type-only), so it adds no runtime code.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when this deployment is configured to talk to a Supabase backend. */
export function isCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * Resolve the shared Supabase client, constructing it (and loading the library)
 * on first use. Rejects when the cloud is not configured — callers must gate on
 * {@link isCloudConfigured} first. PKCE flow is pinned so the OAuth redirect
 * returns `?code=` in the query string (handled before the hash router mounts,
 * see authBootstrap), never the implicit `#access_token=` that would collide
 * with HashRouter.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isCloudConfigured()) {
    return Promise.reject(new Error('Supabase is not configured for this deployment.'))
  }
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        // We exchange the auth code ourselves before the router mounts.
        detectSessionInUrl: false,
      },
    }),
  )
  return clientPromise
}

/** OAuth providers this deployment offers, from VITE_AUTH_PROVIDERS. */
export function configuredProviders(): string[] {
  const raw = import.meta.env.VITE_AUTH_PROVIDERS
  if (!raw) return ['google']
  return raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
}
