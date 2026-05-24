import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import {
  DEFAULT_MT_SETTINGS,
  MT_SETTINGS_KEY,
  SEMANTIC_TM_KEY,
  getMTSettings,
  getSemanticTMSettings,
  mergeMTSettings,
  mergeSemanticTMSettings,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'
import type { MTSettings, SemanticTMSettings } from '@/core/types'

beforeEach(async () => {
  await db.settings.clear()
})

describe('settingsRepo', () => {
  it('get returns undefined when key absent', async () => {
    const v = await settingsRepo.get('missing')
    expect(v).toBeUndefined()
  })

  it('round-trips typed JSON', async () => {
    const payload: MTSettings = {
      ...DEFAULT_MT_SETTINGS,
      claude: { ...DEFAULT_MT_SETTINGS.claude, enabled: true, apiKey: 'sk-x' },
    }
    await settingsRepo.set(MT_SETTINGS_KEY, payload)
    const back = await settingsRepo.get<MTSettings>(MT_SETTINGS_KEY)
    expect(back?.claude.apiKey).toBe('sk-x')
    expect(back?.claude.enabled).toBe(true)
  })

  it('delete removes a key', async () => {
    await settingsRepo.set('foo', 1)
    await settingsRepo.delete('foo')
    expect(await settingsRepo.get('foo')).toBeUndefined()
  })
})

describe('mergeMTSettings', () => {
  it('returns defaults for undefined input', () => {
    expect(mergeMTSettings(undefined)).toEqual(DEFAULT_MT_SETTINGS)
  })

  it('overlays partial input on defaults', () => {
    const merged = mergeMTSettings({
      claude: { enabled: true, apiKey: 'sk', model: DEFAULT_MT_SETTINGS.claude.model },
    })
    expect(merged.claude.enabled).toBe(true)
    expect(merged.ollama.endpoint).toBe(DEFAULT_MT_SETTINGS.ollama.endpoint)
  })
})

describe('mergeSemanticTMSettings', () => {
  it('returns defaults for undefined input', () => {
    expect(mergeSemanticTMSettings(undefined)).toMatchObject({
      enabled: false,
      threshold: 0.75,
    })
  })

  it('overlays partial input', () => {
    const merged = mergeSemanticTMSettings({ enabled: true, threshold: 0.8 })
    expect(merged.enabled).toBe(true)
    expect(merged.threshold).toBe(0.8)
  })
})

describe('getMTSettings + getSemanticTMSettings', () => {
  it('return defaults when nothing stored', async () => {
    const mt = await getMTSettings()
    expect(mt.ollama.enabled).toBe(false)
    expect(mt.mymemory.enabled).toBe(true)
    expect(mt.default).toBe('mymemory')
    const sem = await getSemanticTMSettings()
    expect(sem.enabled).toBe(false)
  })

  it('mergeMTSettings keeps mymemory defaults when only other providers stored', () => {
    const merged = mergeMTSettings({
      claude: { enabled: true, apiKey: 'sk', model: DEFAULT_MT_SETTINGS.claude.model },
    })
    expect(merged.mymemory.enabled).toBe(true)
    expect(merged.mymemory.endpoint).toBe(DEFAULT_MT_SETTINGS.mymemory.endpoint)
  })

  it('read what was set', async () => {
    const sem: SemanticTMSettings = {
      enabled: true,
      model: 'Xenova/test-model',
      threshold: 0.81,
    }
    await settingsRepo.set(SEMANTIC_TM_KEY, sem)
    const back = await getSemanticTMSettings()
    expect(back).toEqual(sem)
  })
})
