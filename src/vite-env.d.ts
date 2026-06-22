/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

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
