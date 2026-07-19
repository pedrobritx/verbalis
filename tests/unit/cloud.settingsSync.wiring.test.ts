import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeRow {
  user_id: string
  key: string
  value: unknown
  updated_at: string
}

const remoteRows: FakeRow[] = []
const upserts: FakeRow[] = []

const fakeClient = {
  from() {
    return {
      select() {
        return {
          eq(_c: string, userId: string) {
            return {
              in(_k: string, keys: string[]) {
                return Promise.resolve({
                  data: remoteRows.filter((r) => r.user_id === userId && keys.includes(r.key)),
                  error: null,
                })
              },
            }
          },
        }
      },
      upsert(row: FakeRow) {
        upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }
  },
}

// Force the cloud on and hand the sync a fake client (no network, no real lib).
vi.mock('@/storage/cloud/supabaseClient', () => ({
  isCloudConfigured: () => true,
  getSupabase: async () => fakeClient,
  configuredProviders: () => ['google'],
}))

import { db } from '@/storage/db'
import { settingsRepo, LOOKUP_SETTINGS_KEY } from '@/storage/repositories/settingsRepo'
import { startSettingsSync, stopSettingsSync } from '@/storage/cloud/settingsSync'
import { useAuthStore } from '@/features/account/useAuthStore'

beforeEach(async () => {
  await db.settings.clear()
  remoteRows.length = 0
  upserts.length = 0
  useAuthStore.setState({ status: 'unauthenticated', user: null })
})

afterEach(() => {
  stopSettingsSync()
})

describe('settings sync wiring', () => {
  it('pulls the account settings into Dexie when the user signs in', async () => {
    remoteRows.push({
      user_id: 'u1',
      key: LOOKUP_SETTINGS_KEY,
      value: { defaultTargetLang: 'pt' },
      updated_at: new Date(9000).toISOString(),
    })

    startSettingsSync()
    // Simulate the auth store flipping to authenticated (as init() would).
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })

    await vi.waitFor(async () => {
      expect(await settingsRepo.get(LOOKUP_SETTINGS_KEY)).toEqual({ defaultTargetLang: 'pt' })
    })
  })

  it('pushes an allowlisted local change up while signed in (debounced)', async () => {
    startSettingsSync()
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })
    // Let the initial (empty) pull settle.
    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))

    await settingsRepo.set(LOOKUP_SETTINGS_KEY, { defaultTargetLang: 'es' })

    await vi.waitFor(
      () => {
        expect(upserts.some((u) => u.key === LOOKUP_SETTINGS_KEY)).toBe(true)
      },
      { timeout: 2000 },
    )
    const pushed = upserts.find((u) => u.key === LOOKUP_SETTINGS_KEY)
    expect(pushed?.value).toEqual({ defaultTargetLang: 'es' })
  })

  it('does not push local changes when signed out', async () => {
    startSettingsSync()
    // Still unauthenticated.
    await settingsRepo.set(LOOKUP_SETTINGS_KEY, { defaultTargetLang: 'de' })
    // Give any (incorrect) debounce a chance to fire.
    await new Promise((r) => setTimeout(r, 700))
    expect(upserts).toHaveLength(0)
  })
})
