import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { tmRepo } from '@/storage/repositories/tmRepo'
import type { TMEntry } from '@/core/types'

function makeEntry(over: Partial<TMEntry> = {}): TMEntry {
  return {
    id: crypto.randomUUID(),
    source: 'Hello',
    target: 'Hola',
    sourceLang: 'en',
    targetLang: 'es',
    date: new Date().toISOString(),
    ...over,
  }
}

beforeEach(async () => {
  await db.tm.clear()
})

describe('tmRepo', () => {
  it('findExact returns the matching entry', async () => {
    const e = makeEntry()
    await tmRepo.create(e)
    const found = await tmRepo.findExact('Hello', 'en', 'es')
    expect(found?.id).toBe(e.id)
  })

  it('findExact returns undefined when no match', async () => {
    const found = await tmRepo.findExact('Hello', 'en', 'es')
    expect(found).toBeUndefined()
  })

  it('upsert inserts a new entry when no collision', async () => {
    const id = await tmRepo.upsert({
      source: 'New',
      target: 'Nuevo',
      sourceLang: 'en',
      targetLang: 'es',
      projectId: 'p1',
    })
    expect(id).toBeDefined()
    const all = await db.tm.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].projectId).toBe('p1')
  })

  it('upsert updates target+date on collision', async () => {
    const original = makeEntry({
      source: 'Same',
      target: 'Old',
      date: '2020-01-01T00:00:00.000Z',
    })
    await tmRepo.create(original)
    await new Promise((r) => setTimeout(r, 5))
    const id = await tmRepo.upsert({
      source: 'Same',
      target: 'New',
      sourceLang: 'en',
      targetLang: 'es',
      projectId: 'p2',
    })
    expect(id).toBe(original.id)
    const all = await db.tm.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].target).toBe('New')
    expect(all[0].projectId).toBe('p2')
    expect(all[0].date).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('bulkAdd inserts many', async () => {
    await tmRepo.bulkAdd([
      makeEntry({ source: 'one' }),
      makeEntry({ source: 'two' }),
      makeEntry({ source: 'three' }),
    ])
    const all = await db.tm.toArray()
    expect(all).toHaveLength(3)
  })

  it('removeMany deletes by id list', async () => {
    const entries = [makeEntry({ source: 'a' }), makeEntry({ source: 'b' }), makeEntry({ source: 'c' })]
    await tmRepo.bulkAdd(entries)
    await tmRepo.removeMany([entries[0].id, entries[2].id])
    const left = await db.tm.toArray()
    expect(left).toHaveLength(1)
    expect(left[0].source).toBe('b')
  })

  it('byLangPair filters correctly', async () => {
    await tmRepo.bulkAdd([
      makeEntry({ source: 'a', sourceLang: 'en', targetLang: 'es' }),
      makeEntry({ source: 'b', sourceLang: 'en', targetLang: 'fr' }),
      makeEntry({ source: 'c', sourceLang: 'en', targetLang: 'es' }),
    ])
    const out = await tmRepo.byLangPair('en', 'es')
    expect(out).toHaveLength(2)
    expect(out.map((e) => e.source).sort()).toEqual(['a', 'c'])
  })
})
