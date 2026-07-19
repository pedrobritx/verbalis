import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isCloudConfigured,
  getSupabase,
  configuredProviders,
} from '@/storage/cloud/supabaseClient'

// Default test env leaves VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY unset, so
// this mirrors a local-only deployment: the cloud is off and the module must
// never reach the dynamic `import('@supabase/supabase-js')`.
describe('supabaseClient (cloud unconfigured)', () => {
  it('reports the cloud as not configured', () => {
    expect(isCloudConfigured()).toBe(false)
  })

  it('rejects getSupabase() before importing the library', async () => {
    await expect(getSupabase()).rejects.toThrow(/not configured/i)
  })
})

describe('configuredProviders', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to google when the env var is unset', () => {
    expect(configuredProviders()).toEqual(['google'])
  })

  it('parses, trims, lowercases, and drops empties', () => {
    vi.stubEnv('VITE_AUTH_PROVIDERS', ' Google, AZURE ,, apple ')
    expect(configuredProviders()).toEqual(['google', 'azure', 'apple'])
  })
})

describe('supabaseClient (cloud configured)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('reports the cloud as configured once both env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'dummy-anon-key')
    vi.resetModules()
    // Re-import so the module-level env constants pick up the stubbed values.
    const mod = await import('@/storage/cloud/supabaseClient')
    expect(mod.isCloudConfigured()).toBe(true)
  })
})
