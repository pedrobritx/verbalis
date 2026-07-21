import { MT_PROVIDERS, MT_EXTENSION_ID, type MTProvider } from '@/core/mt'
import { MT_EXTENSION_MANIFESTS } from '@/core/extensions/builtins'
import { extensionRegistry } from '@/core/extensions/registry'
import type { ExtensionManifest } from '@/core/extensions/types'
import type { MTProviderId } from '@/core/types'

/**
 * MT providers as built-in addons (ROADMAP §6.1). Thin **wrappers** that pair
 * each existing `core/mt` provider with its manifest — **no provider logic moves
 * here** (the existing MT unit tests keep proving behaviour). This is the
 * addon-shaped view the registry and the future Add-ons page consume.
 */

export interface MTProviderExtension {
  manifest: ExtensionManifest
  provider: MTProvider
}

const EXT_TO_PROVIDER: Record<string, MTProviderId> = Object.fromEntries(
  (Object.entries(MT_EXTENSION_ID) as [MTProviderId, string][]).map(([id, ext]) => [ext, id]),
)

/** Every MT provider addon, manifest paired to its core provider. */
export const mtProviderExtensions: MTProviderExtension[] = MT_EXTENSION_MANIFESTS.map((manifest) => ({
  manifest,
  provider: MT_PROVIDERS[EXT_TO_PROVIDER[manifest.id]],
}))

/** The MT provider ids whose addon is currently enabled in the registry. */
export function registryEnabledMtProviderIds(): MTProviderId[] {
  return mtProviderExtensions
    .filter((e) => extensionRegistry.isEnabled(e.manifest.id))
    .map((e) => EXT_TO_PROVIDER[e.manifest.id])
}
