import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MTProviderId, MTSettings } from '@/core/types'
import {
  MT_SETTINGS_KEY,
  mergeMTSettings,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'
import { resolveDefaultProvider } from '@/core/mt'

export function useMTSettings(): {
  settings: MTSettings
  defaultProvider: MTProviderId | undefined
  enabledIds: MTProviderId[]
} {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<MTSettings>>(MT_SETTINGS_KEY),
    [],
  )
  return useMemo(() => {
    const settings = mergeMTSettings(stored)
    const defaultProvider = resolveDefaultProvider(settings)
    const enabledIds: MTProviderId[] = []
    if (settings.ollama.enabled) enabledIds.push('ollama')
    if (settings.claude.enabled) enabledIds.push('claude')
    if (settings.libretranslate.enabled) enabledIds.push('libretranslate')
    return { settings, defaultProvider, enabledIds }
  }, [stored])
}

export async function persistMTSettings(next: MTSettings): Promise<void> {
  await settingsRepo.set(MT_SETTINGS_KEY, next)
}
