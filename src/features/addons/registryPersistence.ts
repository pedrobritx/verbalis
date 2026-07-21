import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions } from '@/core/extensions/builtins'
import { settingsRepo, EXTENSIONS_SETTINGS_KEY } from '@/storage/repositories/settingsRepo'

/**
 * Wires the (dependency-free) extension registry to persistence (ROADMAP §6.1).
 * Registers the built-in manifests synchronously so consumers see them
 * immediately, then hydrates the disabled set from settings and persists any
 * later enable/disable back to Dexie. Device-local (the disabled set is not in
 * the 3.3 cloud-sync allowlist).
 */

let started = false

/** Register built-ins now (sync) so the registry is populated before first render. */
export function registerExtensions(): void {
  registerBuiltinExtensions()
}

/** Hydrate enablement from settings and keep it persisted. Idempotent. */
export async function startExtensionRegistry(): Promise<void> {
  if (started) return
  started = true
  registerBuiltinExtensions()
  const disabled = (await settingsRepo.get<string[]>(EXTENSIONS_SETTINGS_KEY)) ?? []
  extensionRegistry.setDisabledIds(disabled)
  // Persist every subsequent change (fire-and-forget; Dexie stays the record).
  extensionRegistry.subscribe(() => {
    void settingsRepo.set(EXTENSIONS_SETTINGS_KEY, extensionRegistry.getDisabledIds())
  })
}
