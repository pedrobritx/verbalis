import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { setRowSyncEnabled } from '@/storage/cloud/rowSyncState'

beforeEach(async () => {
  await db.glossary.clear()
  await db.tm.clear()
  await db.syncTombstones.clear()
})

describe('repos stamp updatedAt', () => {
  it('glossaryRepo.upsert and tmRepo.upsert set a numeric updatedAt', async () => {
    const gid = await glossaryRepo.upsert({ term: 'casa', definition: 'house', translations: {} })
    const g = await db.glossary.get(gid)
    expect(typeof g?.updatedAt).toBe('number')

    const tid = await tmRepo.upsert({
      source: 'a',
      target: 'b',
      sourceLang: 'en',
      targetLang: 'pt',
    })
    const t = await db.tm.get(tid)
    expect(typeof t?.updatedAt).toBe('number')
  })
})

describe('tombstones are gated on being signed in', () => {
  it('records a tombstone on delete when sync is enabled', async () => {
    setRowSyncEnabled(true)
    const id = await glossaryRepo.upsert({ term: 'x', definition: 'x', translations: {} })
    await glossaryRepo.remove(id)
    expect(await db.glossary.get(id)).toBeUndefined()
    expect(await db.syncTombstones.get(['glossary', id])).toBeDefined()
  })

  it('writes no tombstone when signed out (local-only stays inert)', async () => {
    setRowSyncEnabled(false)
    const id = await glossaryRepo.upsert({ term: 'y', definition: 'y', translations: {} })
    await glossaryRepo.remove(id)
    expect(await db.glossary.get(id)).toBeUndefined()
    expect(await db.syncTombstones.count()).toBe(0)
  })

  it('tmRepo.removeMany tombstones each id when enabled', async () => {
    setRowSyncEnabled(true)
    const a = await tmRepo.upsert({ source: 'a', target: 'b', sourceLang: 'en', targetLang: 'pt' })
    const b = await tmRepo.upsert({ source: 'c', target: 'd', sourceLang: 'en', targetLang: 'pt' })
    await tmRepo.removeMany([a, b])
    expect(await db.syncTombstones.count()).toBe(2)
  })
})
