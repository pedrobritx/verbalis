import { isCloudConfigured, getSupabase } from './supabaseClient'

/**
 * OAuth / magic-link redirect handling for a hash-routed, statically-hosted app
 * (ROADMAP §3 D7). Supabase's PKCE flow returns to `https://host/?code=…`, i.e.
 * the auth code lands in the query string *before* the `#/route` fragment, so
 * HashRouter never sees it. We exchange the code and strip the query — keeping
 * the hash route — before React mounts, so no component ever observes the
 * transient `?code=` URL.
 */

/** Remove the query string while preserving the path and the hash route. */
export function stripAuthQuery(href: string): string {
  const url = new URL(href)
  url.search = ''
  return url.toString()
}

/** True when the current URL carries an auth redirect (`?code=` or `?error=`). */
export function hasAuthRedirect(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.has('code') || params.has('error')
}

/**
 * If the current URL is an auth redirect, exchange the code for a session and
 * clean the URL. Safe to call unconditionally: a no-op when the cloud is not
 * configured or there is no redirect to handle. Never throws.
 */
export async function maybeHandleAuthRedirect(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!isCloudConfigured()) return
  if (!hasAuthRedirect(window.location.search)) return

  const code = new URLSearchParams(window.location.search).get('code')
  try {
    if (code) {
      const supabase = await getSupabase()
      await supabase.auth.exchangeCodeForSession(code)
    }
  } catch {
    // Surfaced later via the auth store's error state; never block boot.
  } finally {
    window.history.replaceState({}, '', stripAuthQuery(window.location.href))
  }
}
