import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  insertCloudProject,
  listCloudProjects,
  fetchCloudProject,
  fetchYdocState,
  setCloudProjectStage,
} from '@/storage/cloud/projectCloud'
import { decodeBytea } from '@/storage/cloud/bytea'

/**
 * In-memory stand-in for the cloud tables + the exact query chains projectCloud
 * uses. Rows are stored snake_cased, exactly as PostgREST would hold them, so
 * the select/insert shapes are exercised end-to-end without a real backend.
 */
function makeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {
    projects: [],
    project_members: [],
    ydoc_state: [],
  }
  let idSeq = 1

  function applyFilters(rows: Record<string, unknown>[], filters: [string, unknown][]) {
    return rows.filter((r) => filters.every(([col, val]) => r[col] === val))
  }

  function selectBuilder(rows: Record<string, unknown>[]) {
    const filters: [string, unknown][] = []
    const builder = {
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return builder
      },
      order() {
        return Promise.resolve({ data: applyFilters(rows, filters), error: null })
      },
      maybeSingle() {
        return Promise.resolve({ data: applyFilters(rows, filters)[0] ?? null, error: null })
      },
    }
    return builder
  }

  const client = {
    from(table: string) {
      const rows = tables[table]
      return {
        insert(row: Record<string, unknown>) {
          const run = () => {
            if (table === 'projects') {
              const id = `cloud-${idSeq++}`
              rows.push({ ...row, id, updated_at: new Date().toISOString() })
              return { id }
            }
            rows.push({ ...row })
            return null
          }
          return {
            select() {
              return {
                single: () => Promise.resolve({ data: run(), error: null }),
              }
            },
            then(onFulfilled: (v: { error: null }) => unknown, onRejected?: () => unknown) {
              run()
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected)
            },
          }
        },
        select() {
          return selectBuilder(rows)
        },
        update(patch: Record<string, unknown>) {
          const filters: [string, unknown][] = []
          const builder = {
            eq(col: string, val: unknown) {
              filters.push([col, val])
              return builder
            },
            then(onFulfilled: (v: { error: null }) => unknown, onRejected?: () => unknown) {
              for (const r of applyFilters(rows, filters)) Object.assign(r, patch)
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected)
            },
          }
          return builder
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, tables }
}

const STATE = new Uint8Array([1, 2, 3, 250, 0, 42])

describe('insertCloudProject', () => {
  it('creates the project, owner membership, and seed snapshot', async () => {
    const { client, tables } = makeClient()
    const cloudId = await insertCloudProject(client, {
      name: 'Doc A',
      sourceLang: 'en',
      targetLang: 'pt',
      ownerId: 'user-1',
      state: STATE,
    })

    expect(cloudId).toBe('cloud-1')
    expect(tables.projects).toHaveLength(1)
    expect(tables.projects[0]).toMatchObject({
      name: 'Doc A',
      source_lang: 'en',
      target_lang: 'pt',
      owner_id: 'user-1',
    })
    // Owner joins as project_manager.
    expect(tables.project_members[0]).toMatchObject({
      project_id: 'cloud-1',
      user_id: 'user-1',
      role: 'project_manager',
    })
    // Snapshot is stored as an encoded bytea that decodes back to the bytes.
    const stored = tables.ydoc_state[0] as { project_id: string; state: string; seq: number }
    expect(stored.project_id).toBe('cloud-1')
    expect(stored.seq).toBe(0)
    expect(decodeBytea(stored.state)).toEqual(STATE)
  })

  it('propagates an insert error', async () => {
    const client = {
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'RLS denied' } }) }) }),
      }),
    } as unknown as SupabaseClient
    await expect(
      insertCloudProject(client, {
        name: 'x',
        sourceLang: 'en',
        targetLang: 'pt',
        ownerId: 'u',
        state: STATE,
      }),
    ).rejects.toThrow(/RLS denied/)
  })
})

describe('listCloudProjects / fetchCloudProject / fetchYdocState', () => {
  it('lists member projects mapped to camelCase', async () => {
    const { client } = makeClient()
    await insertCloudProject(client, {
      name: 'Doc A',
      sourceLang: 'en',
      targetLang: 'pt',
      ownerId: 'user-1',
      state: STATE,
    })
    const list = await listCloudProjects(client)
    expect(list).toEqual([
      { id: 'cloud-1', name: 'Doc A', sourceLang: 'en', targetLang: 'pt', ownerId: 'user-1' },
    ])
  })

  it('fetches a project with the caller role and its snapshot', async () => {
    const { client } = makeClient()
    await insertCloudProject(client, {
      name: 'Doc A',
      sourceLang: 'en',
      targetLang: 'pt',
      ownerId: 'user-1',
      state: STATE,
    })

    const meta = await fetchCloudProject(client, 'cloud-1', 'user-1')
    expect(meta).not.toBeNull()
    expect(meta?.role).toBe('project_manager')
    expect(meta?.summary).toEqual({
      id: 'cloud-1',
      name: 'Doc A',
      sourceLang: 'en',
      targetLang: 'pt',
      ownerId: 'user-1',
    })

    const state = await fetchYdocState(client, 'cloud-1')
    expect(state).toEqual(STATE)
  })

  it('returns null for a project the user cannot see', async () => {
    const { client } = makeClient()
    expect(await fetchCloudProject(client, 'missing', 'user-1')).toBeNull()
    expect(await fetchYdocState(client, 'missing')).toBeNull()
  })

  it('reads the workflow stage (defaulting to translation) and updates it (§5.2)', async () => {
    const { client, tables } = makeClient()
    await insertCloudProject(client, {
      name: 'Doc A',
      sourceLang: 'en',
      targetLang: 'pt',
      ownerId: 'user-1',
      state: STATE,
    })
    // Unset stage in the row defaults to 'translation'.
    expect((await fetchCloudProject(client, 'cloud-1', 'user-1'))?.stage).toBe('translation')

    await setCloudProjectStage(client, 'cloud-1', 'review')
    expect((tables.projects[0] as { stage?: string }).stage).toBe('review')
    expect((await fetchCloudProject(client, 'cloud-1', 'user-1'))?.stage).toBe('review')
  })

  it('defaults role to translator when membership is absent', async () => {
    const { client, tables } = makeClient()
    // A project visible via RLS but with no membership row for this user.
    tables.projects.push({
      id: 'cloud-9',
      name: 'Shared',
      source_lang: 'en',
      target_lang: 'pt',
      owner_id: 'someone',
      updated_at: new Date().toISOString(),
    })
    const meta = await fetchCloudProject(client, 'cloud-9', 'user-1')
    expect(meta?.role).toBe('translator')
  })
})
