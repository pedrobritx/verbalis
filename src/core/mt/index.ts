import type { MTProviderId, MTSettings } from '@/core/types'
import { extensionRegistry } from '@/core/extensions/registry'
import { ollamaProvider } from './ollama'
import { claudeProvider } from './claude'
import { libreTranslateProvider } from './libretranslate'
import { myMemoryProvider } from './mymemory'
import {
  MTError,
  type MTProvider,
  type ProviderSettings,
  type TranslateInput,
  type TranslateResult,
} from './types'

export { MTError } from './types'
export type {
  TranslateInput,
  TranslateResult,
  MTErrorCode,
  MTProvider,
  ProviderSettings,
} from './types'

export const MT_PROVIDERS: Record<MTProviderId, MTProvider> = {
  mymemory: myMemoryProvider as MTProvider,
  ollama: ollamaProvider as MTProvider,
  claude: claudeProvider as MTProvider,
  libretranslate: libreTranslateProvider as MTProvider,
}

/** The extension-registry manifest id for each MT provider (ROADMAP §6.1). */
export const MT_EXTENSION_ID: Record<MTProviderId, string> = {
  mymemory: 'mt.mymemory',
  ollama: 'mt.ollama',
  claude: 'mt.claude',
  libretranslate: 'mt.libretranslate',
}

/**
 * Whether a provider's built-in extension is enabled. Defaults to enabled when
 * the manifest isn't registered yet (e.g. before startup or in a unit test that
 * doesn't register built-ins), so behaviour is unchanged until an addon is
 * explicitly disabled from the Add-ons page.
 */
export function isProviderExtensionEnabled(id: MTProviderId): boolean {
  const extId = MT_EXTENSION_ID[id]
  return !extensionRegistry.has(extId) || extensionRegistry.isEnabled(extId)
}

export function getProviderSettings(id: MTProviderId, settings: MTSettings): ProviderSettings {
  switch (id) {
    case 'mymemory':
      return settings.mymemory
    case 'ollama':
      return settings.ollama
    case 'claude':
      return settings.claude
    case 'libretranslate':
      return settings.libretranslate
  }
}

export function enabledProviders(settings: MTSettings): MTProviderId[] {
  // A provider is available only when its user setting is on AND its built-in
  // extension is enabled in the registry (§6.1) — disabling the addon removes it.
  const ids: MTProviderId[] = []
  if (settings.mymemory.enabled && isProviderExtensionEnabled('mymemory')) ids.push('mymemory')
  if (settings.ollama.enabled && isProviderExtensionEnabled('ollama')) ids.push('ollama')
  if (settings.claude.enabled && isProviderExtensionEnabled('claude')) ids.push('claude')
  if (settings.libretranslate.enabled && isProviderExtensionEnabled('libretranslate'))
    ids.push('libretranslate')
  return ids
}

export function resolveDefaultProvider(settings: MTSettings): MTProviderId | undefined {
  const enabled = enabledProviders(settings)
  if (enabled.length === 0) return undefined
  if (settings.default && enabled.includes(settings.default)) return settings.default
  return enabled[0]
}

export async function translateWith(
  id: MTProviderId,
  input: TranslateInput,
  settings: MTSettings,
): Promise<TranslateResult> {
  const provider = MT_PROVIDERS[id]
  const providerSettings = getProviderSettings(id, settings)
  if (!providerSettings.enabled) {
    throw new MTError(id, 'invalid', `${provider.label} is not enabled`)
  }
  return provider.translate(input, providerSettings)
}
