import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '@/storage/db'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { setRowSyncEnabled } from '@/storage/cloud/rowSyncState'
import { pushResource, pullResource, syncResource, syncAllResources } from '@/storage/cloud/rowSync'
import type { GlossaryEntry } from '@/core/types'

interface ServerRow {
  id: string
  user_id: string
  updated_at: string
  deleted: boolean
  payload: unknown
}

/** In-memory stand-in for the two Supabase tables + the query chains we use. */
function makeServer() {
  const tables: Record<string, Map<string, ServerRow>> = {
    personal_glossary: new Map(),
    personal_tm: new Map(),
  }
  const client = {
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
                      const data = [...rows.values()]
                        .filter((r) => r.user_id === userId && Date.parse(r.updated_at) > cutoff)
                        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
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
  return { client: client as unknown as SupabaseClient, tables }
}

const G = 'personal_glossary'
const glossaryAdapter = {
  resource: 'glossary' as const,
  table: G,
  cursorKey: 'sync.cursor.glossary',
  localChangedSince: (cursor: number) => db.glossary.where('updatedAt').above(cursor).toArray(),
  localUpdatedAt: async (id: string) => (await db.glossary.get(id))?.updatedAt,
  localPut: async (row: GlossaryEntry) => {
    await db.glossary.put(row)
  },
  localDelete: async (id: string) => {
    await db.glossary.delete(id)
    await db.syncTombstones.delete(['glossary', id])
  },
}

function entry(id: string, term: string, updatedAt: number): GlossaryEntry {
  return { id, term, definition: term, translations: {}, updatedAt }
}

beforeEach(async () => {
  await db.glossary.clear()
  await db.tm.clear()
  await db.syncTombstones.clear()
  await db.settings.clear()
  setRowSyncEnabled(true)
})

describe('pushResource', () => {
  it('uploads personal rows and clears pushed tombstones', async () => {
    const { client, tables } = makeServer()
    await db.glossary.put(entry('g1', 'casa', 1000))
    await db.syncTombstones.put({ resource: 'glossary', rowId: 'gone', deletedAt: 2000 })

    await pushResource(client, 'u1', glossaryAdapter, 0)

    expect(tables[G].get('g1')?.deleted).toBe(false)
    expect(tables[G].get('gone')?.deleted).toBe(true)
    // Tombstone consumed after a successful push.
    expect(await db.syncTombstones.count()).toBe(0)
  })

  it('excludes bundled-corpus TM rows', async () => {
    const { client, tables } = makeServer()
    await db.tm.bulkPut([
      {
        id: 't1',
        source: 'a',
        target: 'b',
        sourceLang: 'en',
        targetLang: 'pt',
        date: 'x',
        updatedAt: 10,
      },
      {
        id: 'c1',
        source: 'c',
        target: 'd',
        sourceLang: 'en',
        targetLang: 'pt',
        date: 'x',
        updatedAt: 10,
        corpusId: 'pack1',
      },
    ])
    const tmAdapter = {
      resource: 'tm' as const,
      table: 'personal_tm',
      cursorKey: 'sync.cursor.tm',
      localChangedSince: async (cursor: number) =>
        (await db.tm.where('updatedAt').above(cursor).toArray()).filter((r) => !r.corpusId),
      localUpdatedAt: async (id: string) => (await db.tm.get(id))?.updatedAt,
      localPut: async () => {},
      localDelete: async () => {},
    }
    await pushResource(client, 'u1', tmAdapter, 0)
    expect(tables.personal_tm.has('t1')).toBe(true)
    expect(tables.personal_tm.has('c1')).toBe(false)
  })
})

describe('pullResource (LWW)', () => {
  it('applies newer remote rows and advances the cursor', async () => {
    const { client, tables } = makeServer()
    tables[G].set('g1', {
      id: 'g1',
      user_id: 'u1',
      updated_at: new Date(5000).toISOString(),
      deleted: false,
      payload: entry('g1', 'remote', 5000),
    })

    const next = await pullResource(client, 'u1', glossaryAdapter, 0)

    expect((await db.glossary.get('g1'))?.term).toBe('remote')
    expect(next).toBe(5000)
  })

  it('keeps a newer local row over an older remote', async () => {
    const { client, tables } = makeServer()
    await db.glossary.put(entry('g1', 'local-new', 9000))
    tables[G].set('g1', {
      id: 'g1',
      user_id: 'u1',
      updated_at: new Date(3000).toISOString(),
      deleted: false,
      payload: entry('g1', 'remote-old', 3000),
    })

    await pullResource(client, 'u1', glossaryAdapter, 0)

    expect((await db.glossary.get('g1'))?.term).toBe('local-new')
  })

  it('applies a remote delete (tombstone does not resurrect)', async () => {
    const { client, tables } = makeServer()
    await db.glossary.put(entry('g1', 'doomed', 1000))
    tables[G].set('g1', {
      id: 'g1',
      user_id: 'u1',
      updated_at: new Date(4000).toISOString(),
      deleted: true,
      payload: {},
    })

    await pullResource(client, 'u1', glossaryAdapter, 0)

    expect(await db.glossary.get('g1')).toBeUndefined()
  })

  it('keeps a row edited locally after a remote delete', async () => {
    const { client, tables } = makeServer()
    await db.glossary.put(entry('g1', 'revived', 7000))
    tables[G].set('g1', {
      id: 'g1',
      user_id: 'u1',
      updated_at: new Date(4000).toISOString(),
      deleted: true,
      payload: {},
    })

    await pullResource(client, 'u1', glossaryAdapter, 0)

    expect((await db.glossary.get('g1'))?.term).toBe('revived')
  })
})

describe('syncResource + syncAllResources', () => {
  it('round-trips a local row up and a remote row down, persisting the cursor', async () => {
    const { client, tables } = makeServer()
    await db.glossary.put(entry('local', 'mine', 1000))
    // Another device already wrote a newer row on the server.
    tables[G].set('remote', {
      id: 'remote',
      user_id: 'u1',
      updated_at: new Date(6000).toISOString(),
      deleted: false,
      payload: entry('remote', 'theirs', 6000),
    })

    await syncResource(client, 'u1', glossaryAdapter)

    // Local row pushed up; remote row pulled down.
    expect(tables[G].get('local')?.deleted).toBe(false)
    expect((await db.glossary.get('remote'))?.term).toBe('theirs')
    // Cursor persisted at the max remote timestamp.
    expect(await db.settings.get('sync.cursor.glossary').then((r) => r?.value)).toBe(6000)
  })

  it('two full syncs converge without resurrecting a deleted row', async () => {
    const { client, tables } = makeServer()
    // Device A creates then deletes g1 while signed in.
    await db.glossary.put(entry('g1', 'temp', 1000))
    await syncAllResources(client, 'u1')
    expect(tables[G].get('g1')?.deleted).toBe(false)

    await glossaryRepo.remove('g1') // records a tombstone (sync enabled)
    await syncAllResources(client, 'u1')

    expect(tables[G].get('g1')?.deleted).toBe(true)
    // A later sync must not bring it back.
    await syncAllResources(client, 'u1')
    expect(await db.glossary.get('g1')).toBeUndefined()
  })
})
