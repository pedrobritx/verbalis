/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  /** Supabase project URL. When unset, the app runs 100% local (no cloud UI). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/publishable key, paired with VITE_SUPABASE_URL. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Comma-separated OAuth providers to offer, e.g. "google,azure,apple". */
  readonly VITE_AUTH_PROVIDERS?: string
  /**
   * Google OAuth client id for the Drive storage connector (Phase 6.3). When
   * unset, the Drive "From cloud" / "Save to cloud" affordances stay hidden.
   * Pure client OAuth (Google Identity Services) — independent of Supabase, so
   * the connector works for 100%-local users too.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /**
   * Microsoft (Azure AD) app client id for the OneDrive storage connector
   * (Phase 6.4). Pure client OAuth via `@azure/msal-browser` `loginPopup`
   * (independent of Supabase). When unset, the OneDrive affordances stay hidden.
   */
  readonly VITE_MS_CLIENT_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// nspell ships no types. Minimal surface used by the spell-check engine.
declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean
    suggest(word: string): string[]
    add(word: string): NSpell
    remove(word: string): NSpell
  }
  type Dictionary = { aff: string | Uint8Array; dic: string | Uint8Array }
  function nspell(dictionary: Dictionary): NSpell
  function nspell(aff: string | Uint8Array, dic?: string | Uint8Array): NSpell
  export default nspell
}
