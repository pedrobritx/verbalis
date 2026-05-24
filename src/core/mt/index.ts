import type { MTProviderId, MTSettings } from '@/core/types'
import { ollamaProvider } from './ollama'
import { claudeProvider } from './claude'
import { libreTranslateProvider } from './libretranslate'
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
  ollama: ollamaProvider as MTProvider,
  claude: claudeProvider as MTProvider,
  libretranslate: libreTranslateProvider as MTProvider,
}

export function getProviderSettings(id: MTProviderId, settings: MTSettings): ProviderSettings {
  switch (id) {
    case 'ollama':
      return settings.ollama
    case 'claude':
      return settings.claude
    case 'libretranslate':
      return settings.libretranslate
  }
}

export function enabledProviders(settings: MTSettings): MTProviderId[] {
  const ids: MTProviderId[] = []
  if (settings.ollama.enabled) ids.push('ollama')
  if (settings.claude.enabled) ids.push('claude')
  if (settings.libretranslate.enabled) ids.push('libretranslate')
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
