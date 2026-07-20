import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Row {
  user_id: string
  key: string
  value: unknown
  updated_at: string
}

/** In-memory stand-in for the single-row user_settings query + upsert we use. */
function makeServer(rows: Row[] = []) {
  const upserts: Row[] = []
  const client = {
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
  return { client: client as unknown as SupabaseClient, upserts }
}

import { useSidebarPanelStore } from '@/features/editor/useSidebarPanelStore'
import { syncLayout, LAYOUT_SETTINGS_KEY } from '@/features/editor/layoutSync'

beforeEach(() => {
  localStorage.clear()
  useSidebarPanelStore.setState({ collapsed: {}, updatedAt: 0 })
  useSidebarPanelStore.getState().resetLayout('translate')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncLayout (LWW)', () => {
  it('applies a newer remote layout to the live store', async () => {
    useSidebarPanelStore.setState({ updatedAt: 1000 })
    const remoteLayout = { prepare: [], translate: ['glossary', 'tm'], revise: [] }
    const { client, upserts } = makeServer([
      {
        user_id: 'u1',
        key: LAYOUT_SETTINGS_KEY,
        value: { layout: remoteLayout, collapsed: { tm: true } },
        updated_at: new Date(5000).toISOString(),
      },
    ])

    await syncLayout(client, 'u1')

    const s = useSidebarPanelStore.getState()
    expect(s.layout.translate).toEqual(['glossary', 'tm'])
    expect(s.collapsed.tm).toBe(true)
    expect(s.updatedAt).toBe(5000)
    // Remote was newer → nothing pushed.
    expect(upserts).toHaveLength(0)
  })

  it('pushes the local layout when it is newer than the remote', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9000)
    useSidebarPanelStore.getState().setLayout('translate', ['qa'])
    vi.restoreAllMocks()

    const { client, upserts } = makeServer([
      {
        user_id: 'u1',
        key: LAYOUT_SETTINGS_KEY,
        value: { layout: {}, collapsed: {} },
        updated_at: new Date(3000).toISOString(),
      },
    ])

    await syncLayout(client, 'u1')

    expect(upserts).toHaveLength(1)
    expect(upserts[0].key).toBe(LAYOUT_SETTINGS_KEY)
    expect((upserts[0].value as { layout: Record<string, string[]> }).layout.translate).toEqual([
      'qa',
    ])
  })

  it('pushes when the cloud has no layout row yet', async () => {
    useSidebarPanelStore.setState({ updatedAt: 1 })
    const { client, upserts } = makeServer([])
    await syncLayout(client, 'u1')
    expect(upserts).toHaveLength(1)
  })

  it('does nothing when timestamps are equal', async () => {
    useSidebarPanelStore.setState({ updatedAt: 4000 })
    const { client, upserts } = makeServer([
      {
        user_id: 'u1',
        key: LAYOUT_SETTINGS_KEY,
        value: { layout: {}, collapsed: {} },
        updated_at: new Date(4000).toISOString(),
      },
    ])
    await syncLayout(client, 'u1')
    expect(upserts).toHaveLength(0)
  })
})
