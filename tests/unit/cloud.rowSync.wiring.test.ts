import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ServerRow {
  id: string
  user_id: string
  updated_at: string
  deleted: boolean
  payload: unknown
}

const tables: Record<string, Map<string, ServerRow>> = {
  personal_glossary: new Map(),
  personal_tm: new Map(),
}

const fakeClient = {
  from(table: string) {
    const rows = tables[table]
    return {
      select() {
        return {
          eq(_c: string, userId: string) {
            return {
              gt(_col: string, iso: string) {
                return {
                  order() {
                    const cutoff = Date.parse(iso)
                    const data = [...rows.values()].filter(
                      (r) => r.user_id === userId && Date.parse(r.updated_at) > cutoff,
                    )
                    return Promise.resolve({ data, error: null })
                  },
                }
              },
            }
          },
        }
      },
      upsert(newRows: ServerRow[]) {
        for (const r of newRows) rows.set(r.id, r)
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

import { db } from '@/storage/db'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { startRowSync, stopRowSync } from '@/storage/cloud/rowSync'
import { useAuthStore } from '@/features/account/useAuthStore'

beforeEach(async () => {
  await db.glossary.clear()
  await db.tm.clear()
  await db.syncTombstones.clear()
  await db.settings.clear()
  tables.personal_glossary.clear()
  tables.personal_tm.clear()
  useAuthStore.setState({ status: 'unauthenticated', user: null })
})

afterEach(() => {
  stopRowSync()
})

describe('row sync wiring', () => {
  it('pulls the personal term bank into Dexie on sign-in', async () => {
    tables.personal_glossary.set('g1', {
      id: 'g1',
      user_id: 'u1',
      updated_at: new Date(9000).toISOString(),
      deleted: false,
      payload: { id: 'g1', term: 'remote', definition: 'r', translations: {}, updatedAt: 9000 },
    })

    startRowSync()
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })

    await vi.waitFor(async () => {
      expect((await db.glossary.get('g1'))?.term).toBe('remote')
    })
  })

  it('enables tombstones once signed in, so a delete propagates', async () => {
    startRowSync()
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: null, displayName: null, avatarUrl: null },
    })
    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))

    const id = await glossaryRepo.upsert({ term: 'z', definition: 'z', translations: {} })
    await glossaryRepo.remove(id)

    // Debounced sync pushes the tombstone up as a soft-delete.
    await vi.waitFor(
      () => {
        expect(tables.personal_glossary.get(id)?.deleted).toBe(true)
      },
      { timeout: 2000 },
    )
  })
})
