import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/storage/db'
import {
  settingsRepo,
  EDITOR_SETTINGS_KEY,
  LOOKUP_SETTINGS_KEY,
  SPELL_SETTINGS_KEY,
  MT_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'
import {
  reconcileSettings,
  readLocalSyncedEntries,
  pullAndReconcile,
  pushKey,
  SYNCED_SETTINGS_KEYS,
  type SettingsEntry,
} from '@/storage/cloud/settingsSync'

describe('SYNCED_SETTINGS_KEYS allowlist', () => {
  it('covers editor/lookup/spell and excludes MT (API keys never sync)', () => {
    expect([...SYNCED_SETTINGS_KEYS]).toEqual([
      EDITOR_SETTINGS_KEY,
      LOOKUP_SETTINGS_KEY,
      SPELL_SETTINGS_KEY,
    ])
    expect([...SYNCED_SETTINGS_KEYS]).not.toContain(MT_SETTINGS_KEY)
  })
})

describe('reconcileSettings (per-key LWW)', () => {
  const L = (key: string, updatedAt: number, value: unknown = { v: 'local' }): SettingsEntry => ({
    key,
    value,
    updatedAt,
  })
  const R = (key: string, updatedAt: number, value: unknown = { v: 'remote' }): SettingsEntry => ({
    key,
    value,
    updatedAt,
  })

  it('pushes a key present only locally', () => {
    const { pull, push } = reconcileSettings([L(EDITOR_SETTINGS_KEY, 10)], [])
    expect(push).toHaveLength(1)
    expect(push[0].key).toBe(EDITOR_SETTINGS_KEY)
    expect(pull).toHaveLength(0)
  })

  it('pulls a key present only remotely', () => {
    const { pull, push } = reconcileSettings([], [R(LOOKUP_SETTINGS_KEY, 10)])
    expect(pull).toHaveLength(1)
    expect(pull[0].key).toBe(LOOKUP_SETTINGS_KEY)
    expect(push).toHaveLength(0)
  })

  it('newer side wins on both-present', () => {
    const { pull, push } = reconcileSettings(
      [L(EDITOR_SETTINGS_KEY, 100), L(SPELL_SETTINGS_KEY, 50)],
      [R(EDITOR_SETTINGS_KEY, 40), R(SPELL_SETTINGS_KEY, 200)],
    )
    // editor: local newer → push; spell: remote newer → pull
    expect(push.map((e) => e.key)).toEqual([EDITOR_SETTINGS_KEY])
    expect(pull.map((e) => e.key)).toEqual([SPELL_SETTINGS_KEY])
  })

  it('equal timestamps are left untouched', () => {
    const { pull, push } = reconcileSettings(
      [L(EDITOR_SETTINGS_KEY, 100)],
      [R(EDITOR_SETTINGS_KEY, 100)],
    )
    expect(pull).toHaveLength(0)
    expect(push).toHaveLength(0)
  })

  it('ignores keys outside the allowlist entirely', () => {
    const { pull, push } = reconcileSettings([L(MT_SETTINGS_KEY, 100)], [R(MT_SETTINGS_KEY, 1)])
    expect(pull).toHaveLength(0)
    expect(push).toHaveLength(0)
  })
})

// ---- Integration against real Dexie (fake-indexeddb) + a mocked client ----

interface FakeRow {
  user_id: string
  key: string
  value: unknown
  updated_at: string
}

/** Minimal in-memory stand-in for the two Supabase query builders we use. */
function makeClient(rows: FakeRow[]) {
  const upserts: FakeRow[] = []
  const client = {
    from() {
      return {
        // select(...).eq(...).in(...) resolves to { data, error }
        select() {
          return {
            eq(_col: string, userId: string) {
              return {
                in(_keyCol: string, keys: string[]) {
                  const data = rows.filter((r) => r.user_id === userId && keys.includes(r.key))
                  return Promise.resolve({ data, error: null })
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
  return { client: client as never, upserts }
}

beforeEach(async () => {
  await db.settings.clear()
})

describe('pullAndReconcile', () => {
  it('writes newer remote values into Dexie and pushes newer local ones', async () => {
    // Local editor prefs are newer; local lookup is older than remote; spell only remote.
    await settingsRepo.set(EDITOR_SETTINGS_KEY, { rich: true })
    const editorRow = await settingsRepo.getRow(EDITOR_SETTINGS_KEY)
    const localEditorTs = editorRow!.updatedAt!

    await settingsRepo.applyRemote(LOOKUP_SETTINGS_KEY, { defaultTargetLang: 'en' }, 1000)

    const { client, upserts } = makeClient([
      {
        user_id: 'u1',
        key: EDITOR_SETTINGS_KEY,
        value: { rich: false },
        updated_at: new Date(localEditorTs - 5000).toISOString(),
      },
      {
        user_id: 'u1',
        key: LOOKUP_SETTINGS_KEY,
        value: { defaultTargetLang: 'pt' },
        updated_at: new Date(5000).toISOString(), // newer than local's 1000
      },
      {
        user_id: 'u1',
        key: SPELL_SETTINGS_KEY,
        value: { enabled: true, personalWords: ['foo'] },
        updated_at: new Date(9000).toISOString(),
      },
    ])

    await pullAndReconcile(client, 'u1')

    // Pulled: lookup (remote newer) + spell (remote only)
    expect(await settingsRepo.get(LOOKUP_SETTINGS_KEY)).toEqual({ defaultTargetLang: 'pt' })
    expect(await settingsRepo.get(SPELL_SETTINGS_KEY)).toEqual({
      enabled: true,
      personalWords: ['foo'],
    })
    // Local editor prefs unchanged (local newer) and pushed up.
    expect(await settingsRepo.get(EDITOR_SETTINGS_KEY)).toEqual({ rich: true })
    expect(upserts.map((u) => u.key)).toEqual([EDITOR_SETTINGS_KEY])
    expect(upserts[0].value).toEqual({ rich: true })

    // applyRemote must not have bumped the pulled rows' clock past the remote ts.
    const lookupRow = await settingsRepo.getRow(LOOKUP_SETTINGS_KEY)
    expect(lookupRow!.updatedAt).toBe(5000)
  })
})

describe('pushKey', () => {
  it('upserts the current local value for an allowlisted key', async () => {
    await settingsRepo.set(SPELL_SETTINGS_KEY, { enabled: true, personalWords: [] })
    const { client, upserts } = makeClient([])
    await pushKey(client, 'u1', SPELL_SETTINGS_KEY)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({ user_id: 'u1', key: SPELL_SETTINGS_KEY })
  })

  it('ignores keys outside the allowlist', async () => {
    await settingsRepo.set(MT_SETTINGS_KEY, { default: 'mymemory' })
    const { client, upserts } = makeClient([])
    await pushKey(client, 'u1', MT_SETTINGS_KEY)
    expect(upserts).toHaveLength(0)
  })

  it('is a no-op when the key is absent locally', async () => {
    const { client, upserts } = makeClient([])
    await pushKey(client, 'u1', EDITOR_SETTINGS_KEY)
    expect(upserts).toHaveLength(0)
  })
})

describe('readLocalSyncedEntries', () => {
  it('returns only allowlisted rows that exist, with their timestamps', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(4242)
    await settingsRepo.set(EDITOR_SETTINGS_KEY, { rich: true })
    vi.restoreAllMocks()
    await settingsRepo.set(MT_SETTINGS_KEY, { default: 'x' }) // excluded

    const entries = await readLocalSyncedEntries()
    expect(entries).toEqual([{ key: EDITOR_SETTINGS_KEY, value: { rich: true }, updatedAt: 4242 }])
  })
})
