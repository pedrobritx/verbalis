import type { ExtensionKind, ExtensionManifest } from './types'

/**
 * In-process typed extension registry (ROADMAP §6.1, D9).
 *
 * Holds the manifests of every registered contribution and each one's
 * enable/disable state, and notifies subscribers on any change so the UI stays
 * live. Deliberately dependency-free (no storage / React imports) so it is
 * trivially unit-testable and usable from `core`; persistence of the disabled
 * set is wired separately (see `features/addons/registryPersistence`). Enablement
 * is stored as the *disabled* set, so a freshly registered extension is enabled
 * by default and an unknown id is treated as enabled — behaviour is unchanged
 * until something is explicitly turned off.
 */

type Listener = () => void

class ExtensionRegistry {
  private manifests = new Map<string, ExtensionManifest>()
  private disabled = new Set<string>()
  private listeners = new Set<Listener>()

  /** Register (or replace) a manifest. */
  register(manifest: ExtensionManifest): void {
    this.manifests.set(manifest.id, manifest)
    this.emit()
  }

  /** Remove a manifest (and any disabled flag for it). */
  unregister(id: string): void {
    const had = this.manifests.delete(id)
    this.disabled.delete(id)
    if (had) this.emit()
  }

  get(id: string): ExtensionManifest | undefined {
    return this.manifests.get(id)
  }

  has(id: string): boolean {
    return this.manifests.has(id)
  }

  /** All manifests (optionally of one kind), id-sorted for a stable list order. */
  list(kind?: ExtensionKind): ExtensionManifest[] {
    const all = [...this.manifests.values()]
    return (kind ? all.filter((m) => m.kinds.includes(kind)) : all).sort((a, b) =>
      a.id.localeCompare(b.id),
    )
  }

  /** A registered, not-disabled extension. Unregistered ids are not enabled. */
  isEnabled(id: string): boolean {
    return this.manifests.has(id) && !this.disabled.has(id)
  }

  /** Enable/disable a registered extension. No-op (no notify) when unchanged. */
  setEnabled(id: string, on: boolean): void {
    if (!this.manifests.has(id)) return
    let changed = false
    if (on) {
      changed = this.disabled.delete(id)
    } else if (!this.disabled.has(id)) {
      this.disabled.add(id)
      changed = true
    }
    if (changed) this.emit()
  }

  /** The ids currently disabled (for persistence). */
  getDisabledIds(): string[] {
    return [...this.disabled].sort()
  }

  /** Replace the disabled set wholesale (for hydration from persistence). */
  setDisabledIds(ids: string[]): void {
    this.disabled = new Set(ids)
    this.emit()
  }

  /** Subscribe to any registry change; returns an unsubscribe. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Test helper: clear all state. */
  __resetForTest(): void {
    this.manifests.clear()
    this.disabled.clear()
    this.listeners.clear()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

/** The process-wide registry singleton. */
export const extensionRegistry = new ExtensionRegistry()
export type { ExtensionRegistry }
