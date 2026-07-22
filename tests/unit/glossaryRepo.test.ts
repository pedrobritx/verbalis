import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import type { GlossaryEntry } from '@/core/types'

function makeEntry(over: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: crypto.randomUUID(),
    term: 'hello',
    definition: 'a greeting',
    translations: { es: 'hola' },
    ...over,
  }
}

beforeEach(async () => {
  await db.glossary.clear()
})

describe('glossaryRepo', () => {
  it('create + getById round-trips', async () => {
    const e = makeEntry()
    await glossaryRepo.create(e)
    const found = await glossaryRepo.getById(e.id)
    expect(found?.term).toBe('hello')
  })

  it('bulkAdd inserts many', async () => {
    await glossaryRepo.bulkAdd([
      makeEntry({ term: 'one' }),
      makeEntry({ term: 'two' }),
      makeEntry({ term: 'three' }),
    ])
    const all = await glossaryRepo.getAll()
    expect(all).toHaveLength(3)
  })

  it('removeMany deletes by id list', async () => {
    const entries = [makeEntry({ term: 'a' }), makeEntry({ term: 'b' }), makeEntry({ term: 'c' })]
    await glossaryRepo.bulkAdd(entries)
    await glossaryRepo.removeMany([entries[0].id, entries[2].id])
    const left = await glossaryRepo.getAll()
    expect(left).toHaveLength(1)
    expect(left[0].term).toBe('b')
  })

  it('findByTerm is case-insensitive and respects projectId scoping', async () => {
    await glossaryRepo.create(makeEntry({ term: 'Apple', projectId: 'p1' }))
    await glossaryRepo.create(makeEntry({ term: 'Banana' }))

    const found = await glossaryRepo.findByTerm('apple', 'p1')
    expect(found?.term).toBe('Apple')

    const notInProject = await glossaryRepo.findByTerm('apple', 'p2')
    expect(notInProject).toBeUndefined()

    const global = await glossaryRepo.findByTerm('banana')
    expect(global?.term).toBe('Banana')
  })

  it('upsert inserts a new entry when no collision', async () => {
    const id = await glossaryRepo.upsert({
      term: 'new',
      definition: 'd',
      translations: { es: 'nuevo' },
    })
    expect(id).toBeDefined()
    const all = await glossaryRepo.getAll()
    expect(all).toHaveLength(1)
  })

  it('upsert merges translations on collision and preserves existing definition when blank', async () => {
    await glossaryRepo.create(
      makeEntry({
        term: 'cat',
        definition: 'a small feline',
        translations: { es: 'gato' },
        projectId: 'p1',
      }),
    )
    await glossaryRepo.upsert({
      term: 'cat',
      definition: '',
      translations: { fr: 'chat' },
      projectId: 'p1',
    })
    const all = await glossaryRepo.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].definition).toBe('a small feline')
    expect(all[0].translations).toEqual({ es: 'gato', fr: 'chat' })
  })

  it('upsert dedups across project-scoped entries by normalized term', async () => {
    await glossaryRepo.upsert({
      term: 'Dog',
      definition: 'mammal',
      translations: { es: 'perro' },
      projectId: 'p1',
    })
    await glossaryRepo.upsert({
      term: 'dog',
      definition: 'updated',
      translations: { fr: 'chien' },
      projectId: 'p1',
    })
    const all = await glossaryRepo.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].translations).toEqual({ es: 'perro', fr: 'chien' })
  })

  it('byProjectOrGlobal returns project-scoped + unassigned entries', async () => {
    await glossaryRepo.bulkAdd([
      makeEntry({ term: 'scoped', projectId: 'p1' }),
      makeEntry({ term: 'other', projectId: 'p2' }),
      makeEntry({ term: 'global' }),
    ])
    const out = await glossaryRepo.byProjectOrGlobal('p1')
    const terms = out.map((e) => e.term).sort()
    expect(terms).toEqual(['global', 'scoped'])
  })
})
