import { beforeEach, describe, expect, it } from 'vitest'
import type { MTSettings } from '@/core/types'
import { enabledProviders, MT_PROVIDERS } from '@/core/mt'
import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions, __resetBuiltinsForTest } from '@/core/extensions/builtins'
import { mtProviderExtensions, registryEnabledMtProviderIds } from '@/extensions/mt'

/** All four MT providers turned on at the user-settings level. */
const ALL_ON: MTSettings = {
  default: 'mymemory',
  mymemory: { enabled: true },
  ollama: { enabled: true, baseUrl: '', model: '' },
  claude: { enabled: true, apiKey: '', model: '' },
  libretranslate: { enabled: true, baseUrl: '', apiKey: '' },
} as unknown as MTSettings

beforeEach(() => {
  extensionRegistry.__resetForTest()
  __resetBuiltinsForTest()
  registerBuiltinExtensions()
})

describe('MT providers as built-in addons (§6.1)', () => {
  it('registers the four MT providers as mt-provider manifests', () => {
    const ids = extensionRegistry.list('mt-provider').map((m) => m.id)
    expect(ids).toEqual(['mt.claude', 'mt.libretranslate', 'mt.mymemory', 'mt.ollama'])
  })

  it('wraps each manifest onto its existing core provider (no logic moved)', () => {
    for (const ext of mtProviderExtensions) {
      expect(ext.provider).toBe(MT_PROVIDERS[ext.provider.id])
      expect(ext.manifest.kinds).toContain('mt-provider')
    }
  })

  it('runs providers through the registry: all enabled by default', () => {
    expect(enabledProviders(ALL_ON).sort()).toEqual(
      ['claude', 'libretranslate', 'mymemory', 'ollama'].sort(),
    )
    expect(registryEnabledMtProviderIds().sort()).toEqual(
      ['claude', 'libretranslate', 'mymemory', 'ollama'].sort(),
    )
  })

  it('disabling an addon removes it from the resolved providers (the DoD)', () => {
    extensionRegistry.setEnabled('mt.claude', false)
    // claude is still enabled in user settings, but its addon is off.
    expect(enabledProviders(ALL_ON)).not.toContain('claude')
    expect(enabledProviders(ALL_ON).sort()).toEqual(['libretranslate', 'mymemory', 'ollama'].sort())
    expect(registryEnabledMtProviderIds()).not.toContain('claude')

    // Re-enabling brings it back.
    extensionRegistry.setEnabled('mt.claude', true)
    expect(enabledProviders(ALL_ON)).toContain('claude')
  })
})
