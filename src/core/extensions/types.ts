/**
 * Extension manifest contract (ROADMAP §6, D9).
 *
 * Verbalis v1 hosts extensions **in-process** through a typed registry — no
 * sandbox yet — but the manifest/permission shape is **final now**, so future
 * sandboxed (iframe/worker RPC) third-party extensions declare themselves the
 * same way and never migrate. Built-in capabilities (MT providers first, QA
 * rules + import/export formats + connectors next) are re-expressed as manifests
 * so everything pluggable is described uniformly and can be listed, permission-
 * inspected, and enabled/disabled from one place (the 6.2 Add-ons page).
 */

/** What an extension contributes. One extension may contribute several kinds. */
export type ExtensionKind =
  'mt-provider' | 'qa-rule' | 'panel' | 'import-format' | 'export-format' | 'storage-connector'

/** A capability an extension needs — surfaced to the user before enabling it. */
export type ExtensionPermission =
  | 'network' // makes outbound network requests
  | 'credentials' // stores/uses an API key or token
  | 'storage' // reads/writes local project data
  | 'clipboard'
  | 'filesystem' // reads/writes files (import/export)

export interface ExtensionManifest {
  /** Stable, namespaced id, e.g. `mt.claude`. Unique across the registry. */
  id: string
  /** Human-facing name shown in the Add-ons page. */
  name: string
  /** Semver of the contribution (independent of the app version). */
  version: string
  /** The capability kinds this extension contributes. */
  kinds: ExtensionKind[]
  /** Permissions the extension needs, shown before enabling. */
  permissions: ExtensionPermission[]
  /** True for capabilities that ship with the app (not user-installed). */
  builtIn: boolean
  /** One-line description for the catalogue. */
  description?: string
}
