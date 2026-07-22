import { useMemo, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MTProviderId, MTSettings } from '@/core/types'
import { MT_SETTINGS_KEY, mergeMTSettings, settingsRepo } from '@/storage/repositories/settingsRepo'
import { resolveDefaultProvider, isProviderExtensionEnabled } from '@/core/mt'
import { extensionRegistry } from '@/core/extensions/registry'

export function useMTSettings(): {
  settings: MTSettings
  defaultProvider: MTProviderId | undefined
  enabledIds: MTProviderId[]
} {
  const stored = useLiveQuery(() => settingsRepo.get<Partial<MTSettings>>(MT_SETTINGS_KEY), [])
  // Re-derive when an MT addon is enabled/disabled in the registry (§6.1), so
  // disabling one removes it from the panel live.
  const registryVersion = useSyncExternalStore(
    (cb) => extensionRegistry.subscribe(cb),
    () => extensionRegistry.getDisabledIds().join(','),
    () => '',
  )
  return useMemo(() => {
    const settings = mergeMTSettings(stored)
    const defaultProvider = resolveDefaultProvider(settings)
    const enabledIds: MTProviderId[] = []
    if (settings.ollama.enabled && isProviderExtensionEnabled('ollama')) enabledIds.push('ollama')
    if (settings.claude.enabled && isProviderExtensionEnabled('claude')) enabledIds.push('claude')
    if (settings.libretranslate.enabled && isProviderExtensionEnabled('libretranslate'))
      enabledIds.push('libretranslate')
    return { settings, defaultProvider, enabledIds }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, registryVersion])
}

export async function persistMTSettings(next: MTSettings): Promise<void> {
  await settingsRepo.set(MT_SETTINGS_KEY, next)
}
