import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { projectRepo } from '@/storage/repositories/projectRepo'
import type { EmbeddingRecord, GlossaryEntry, Project, Segment, TMEntry } from '@/core/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = '2020-01-01T00:00:00.000Z'
  return {
    id: crypto.randomUUID(),
    name: 'Project',
    sourceLang: 'en',
    targetLang: 'es',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeSeg(projectId: string, overrides: Partial<Segment> = {}): Segment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    projectId,
    index: 0,
    source: 'src',
    target: '',
    status: 'untranslated',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(async () => {
  await Promise.all([
    db.projects.clear(),
    db.segments.clear(),
    db.tm.clear(),
    db.glossary.clear(),
    db.embeddings.clear(),
  ])
})

describe('projectRepo.update', () => {
  it('applies changes and refreshes updatedAt', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    await projectRepo.update(p.id, { name: 'Renamed', targetLang: 'fr' })
    const stored = await projectRepo.getById(p.id)
    expect(stored?.name).toBe('Renamed')
    expect(stored?.targetLang).toBe('fr')
    expect(stored?.updatedAt).not.toBe(p.updatedAt)
  })
})

describe('projectRepo.deletionStats', () => {
  it('counts project-scoped segments, TM and glossary', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    await db.segments.bulkAdd([makeSeg(p.id), makeSeg(p.id)])
    await db.tm.add({
      id: 't1',
      source: 'a',
      target: 'b',
      sourceLang: 'en',
      targetLang: 'es',
      projectId: p.id,
      date: '2024-01-01',
    } as TMEntry)
    await db.glossary.add({
      id: 'g1',
      term: 'x',
      definition: '',
      translations: {},
      projectId: p.id,
    } as GlossaryEntry)
    const stats = await projectRepo.deletionStats(p.id)
    expect(stats).toEqual({ segments: 2, tmEntries: 1, glossaryEntries: 1 })
  })
})

describe('projectRepo.removeCascade', () => {
  it('deletes the project and its segments, preserving TM/glossary by default', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    await db.segments.bulkAdd([makeSeg(p.id), makeSeg(p.id)])
    await db.tm.add({
      id: 't1',
      source: 'a',
      target: 'b',
      sourceLang: 'en',
      targetLang: 'es',
      projectId: p.id,
      date: '2024-01-01',
    } as TMEntry)

    await projectRepo.removeCascade(p.id)

    expect(await projectRepo.getById(p.id)).toBeUndefined()
    expect(await db.segments.where('projectId').equals(p.id).count()).toBe(0)
    expect(await db.tm.count()).toBe(1) // preserved
  })

  it('deletes project-scoped TM, glossary and embeddings when requested', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    await db.tm.add({
      id: 't1',
      source: 'a',
      target: 'b',
      sourceLang: 'en',
      targetLang: 'es',
      projectId: p.id,
      date: '2024-01-01',
    } as TMEntry)
    await db.glossary.add({
      id: 'g1',
      term: 'x',
      definition: '',
      translations: {},
      projectId: p.id,
    } as GlossaryEntry)
    await db.embeddings.add({
      id: 'e1',
      tmId: 't1',
      model: 'm',
      dim: 1,
      vector: new Float32Array([1]),
      createdAt: '2024-01-01',
    } as EmbeddingRecord)

    await projectRepo.removeCascade(p.id, { deleteResources: true })

    expect(await db.tm.count()).toBe(0)
    expect(await db.glossary.count()).toBe(0)
    expect(await db.embeddings.count()).toBe(0)
  })

  it('leaves global (unassigned) TM untouched even with deleteResources', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    await db.tm.add({
      id: 'global',
      source: 'a',
      target: 'b',
      sourceLang: 'en',
      targetLang: 'es',
      date: '2024-01-01',
    } as TMEntry)
    await projectRepo.removeCascade(p.id, { deleteResources: true })
    expect(await db.tm.count()).toBe(1)
  })
})

describe('projectRepo.duplicate', () => {
  it('clones the project and its segments under new ids', async () => {
    const p = makeProject({ name: 'Original' })
    await projectRepo.create(p)
    await db.segments.bulkAdd([
      makeSeg(p.id, { index: 0, source: 'a', target: 'A', status: 'translated' }),
      makeSeg(p.id, { index: 1, source: 'b' }),
    ])

    const newId = await projectRepo.duplicate(p.id)
    expect(newId).toBeTruthy()
    expect(newId).not.toBe(p.id)

    const clone = await projectRepo.getById(newId as string)
    expect(clone?.name).toBe('Original (copy)')

    const cloneSegs = await db.segments
      .where('projectId')
      .equals(newId as string)
      .sortBy('index')
    expect(cloneSegs.map((s) => [s.source, s.target])).toEqual([
      ['a', 'A'],
      ['b', ''],
    ])
    // Original segments untouched.
    expect(await db.segments.where('projectId').equals(p.id).count()).toBe(2)
  })

  it('uses a custom name when provided and returns null for a missing project', async () => {
    const p = makeProject()
    await projectRepo.create(p)
    const newId = await projectRepo.duplicate(p.id, 'Custom name')
    expect((await projectRepo.getById(newId as string))?.name).toBe('Custom name')
    expect(await projectRepo.duplicate('does-not-exist')).toBeNull()
  })
})
