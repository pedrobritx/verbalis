import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
  user_id: string
  key: string
  value: unknown
  updated_at: string
}

const rows: Row[] = []
const upserts: Row[] = []

const fakeClient = {
  from() {
    return {
      select() {
        return {
          eq(_c: string, userId: string) {
            return {
              eq(_c2: string, key: string) {
                return {
                  maybeSingle() {
                    const row = rows.find((r) => r.user_id === userId && r.key === key)
                    return Promise.resolve({ data: row ?? null, error: null })
                  },
                }
              },
            }
          },
        }
      },
      upsert(row: Row) {
        upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }
  },
}

vi.mock('@/storage/cloud/supabaseClient', () => ({
  isCloudConfigured: () => true,
  getSupabase: async () => fakeClient,
  configuredProviders: () => ['google'],
}))

import { useSidebarPanelStore } from '@/features/editor/useSidebarPanelStore'
import { startLayoutSync, stopLayoutSync, LAYOUT_SETTINGS_KEY } from '@/features/editor/layoutSync'
import { useAuthStore } from '@/features/account/useAuthStore'

beforeEach(() => {
  localStorage.clear()
  rows.length = 0
  upserts.length = 0
  useSidebarPanelStore.getState().resetLayout('translate')
  // resetLayout stamps updatedAt(now); zero it so a remote ts can win in tests.
  useSidebarPanelStore.setState({ collapsed: {}, updatedAt: 0 })
  useAuthStore.setState({ status: 'unauthenticated', user: null })
})

afterEach(() => {
  stopLayoutSync()
  vi.restoreAllMocks()
})

describe('layout sync wiring', () => {
  it('applies the cloud layout to the live store on sign-in', async () => {
    rows.push({
      user_id: 'u1',
      key: LAYOUT_SETTINGS_KEY,
      value: { layout: { prepare: [], translate: ['glossary'], revise: [] }, collapsed: {} },
      updated_at: new Date(8000).toISOString(),
    })

    startLayoutSync()
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })

    await vi.waitFor(() => {
      expect(useSidebarPanelStore.getState().layout.translate).toEqual(['glossary'])
    })
  })

  it('pushes a local layout change (debounced) while signed in', async () => {
    startLayoutSync()
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })
    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
    upserts.length = 0 // ignore any sign-in reconcile push

    useSidebarPanelStore.getState().togglePanel('translate', 'qa')

    await vi.waitFor(() => expect(upserts.some((u) => u.key === LAYOUT_SETTINGS_KEY)).toBe(true), {
      timeout: 2000,
    })
  })
})
