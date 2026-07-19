import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateTemplatesToOwnTable, migrateDocumentBlocks } from '@/storage/db'

// Exercises the real v4 upgrade callback on a throwaway database that starts on
// the v3 schema (templateXml inline on the project) and migrates to v4 (template
// in its own table).
const DB_NAME = 'verbalis-migration-test'

function openV3(): Dexie {
  const db = new Dexie(DB_NAME)
  db.version(3).stores({
    projects: 'id, name, updatedAt',
    segments: 'id, projectId, index, status',
    tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
    glossary: 'id, term, projectId',
    settings: '&key',
    embeddings: 'id, tmId, model, [tmId+model]',
    corpusTerms: 'id, corpusId',
    corpusPacks: 'id',
  })
  return db
}

function openV4(): Dexie {
  const db = new Dexie(DB_NAME)
  db.version(3).stores({
    projects: 'id, name, updatedAt',
    segments: 'id, projectId, index, status',
    tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
    glossary: 'id, term, projectId',
    settings: '&key',
    embeddings: 'id, tmId, model, [tmId+model]',
    corpusTerms: 'id, corpusId',
    corpusPacks: 'id',
  })
  db.version(4)
    .stores({
      projects: 'id, name, updatedAt',
      projectTemplates: 'projectId',
      segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
      tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
      glossary: 'id, term, projectId',
      settings: '&key',
      embeddings: 'id, tmId, model, [tmId+model]',
      corpusTerms: 'id, corpusId',
      corpusPacks: 'id',
    })
    .upgrade(migrateTemplatesToOwnTable)
  return db
}

function openV5(): Dexie {
  const db = openV4()
  db.version(5).stores({
    projects: 'id, name, updatedAt',
    projectTemplates: 'projectId',
    segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
    tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
    glossary: 'id, term, projectId',
    settings: '&key',
    embeddings: 'id, tmId, model, [tmId+model]',
    corpusTerms: 'id, corpusId',
    corpusPacks: 'id',
    versions: 'id, projectId, createdAt, [projectId+createdAt]',
  })
  return db
}

function openV6(): Dexie {
  const db = openV5()
  db.version(6)
    .stores({
      projects: 'id, name, updatedAt',
      projectTemplates: 'projectId',
      segments: 'id, projectId, index, status, [projectId+status], [projectId+index]',
      tm: 'id, source, sourceLang, targetLang, projectId, corpusId',
      glossary: 'id, term, projectId',
      settings: '&key',
      embeddings: 'id, tmId, model, [tmId+model]',
      corpusTerms: 'id, corpusId',
      corpusPacks: 'id',
      versions: 'id, projectId, createdAt, [projectId+createdAt]',
      documents: 'id, projectId',
      blocks: 'id, documentId, projectId, [documentId+index]',
      assets: 'id, documentId, projectId',
    })
    .upgrade(migrateDocumentBlocks)
  return db
}

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

describe('v4 template migration', () => {
  it('moves inline templateXml into projectTemplates and strips it from the project', async () => {
    const v3 = openV3()
    await v3.table('projects').bulkAdd([
      {
        id: 'xliff',
        name: 'Bilingual',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        createdAt: 'now',
        updatedAt: 'now',
        bilingualMeta: {
          format: 'xliff12',
          originalFile: 'doc.xlf',
          datatype: 'plaintext',
          templateXml: '<xliff>…</xliff>',
        },
      },
      {
        id: 'plain',
        name: 'Plain',
        sourceLang: 'en',
        targetLang: 'fr',
        createdAt: 'now',
        updatedAt: 'now',
      },
    ])
    v3.close()

    const v4 = openV4()
    const template = await v4.table('projectTemplates').get('xliff')
    expect(template).toEqual({ projectId: 'xliff', templateXml: '<xliff>…</xliff>' })

    const xliff = await v4.table('projects').get('xliff')
    expect(xliff.bilingualMeta.templateXml).toBeUndefined()
    // Other bilingual metadata is preserved.
    expect(xliff.bilingualMeta.originalFile).toBe('doc.xlf')
    expect(xliff.bilingualMeta.datatype).toBe('plaintext')

    // Non-XLIFF projects are untouched and gain no template row.
    expect(await v4.table('projectTemplates').get('plain')).toBeUndefined()
    v4.close()
  })
})

describe('v5 versions table', () => {
  it('adds the versions table and preserves existing data', async () => {
    const v4 = openV4()
    await v4.table('projects').add({
      id: 'p1',
      name: 'Keep me',
      sourceLang: 'pt-BR',
      targetLang: 'en',
      createdAt: 'now',
      updatedAt: 'now',
    })
    await v4.table('segments').add({
      id: 's1',
      projectId: 'p1',
      index: 0,
      source: 'oi',
      target: 'hi',
      status: 'translated',
      createdAt: 'now',
      updatedAt: 'now',
    })
    v4.close()

    const v5 = openV5()
    // New table exists and is writable/queryable via its compound index.
    await v5.table('versions').add({
      id: 'v1',
      projectId: 'p1',
      kind: 'named',
      label: 'first',
      snapshot: new Uint8Array([1, 2, 3]),
      segmentCount: 1,
      createdAt: '2020-01-01T00:00:00.000Z',
    })
    const got = await v5.table('versions').get('v1')
    expect(got.label).toBe('first')

    // Pre-existing data survived the upgrade untouched.
    expect((await v5.table('projects').get('p1')).name).toBe('Keep me')
    expect((await v5.table('segments').get('s1')).target).toBe('hi')
    v5.close()
  })
})

describe('v6 document/block backfill', () => {
  it('builds a document + blocks for monolingual projects and stamps blockId', async () => {
    const v5 = openV5()
    await v5.table('projects').bulkAdd([
      { id: 'mono', name: 'Doc', sourceLang: 'en', targetLang: 'fr', createdAt: 'n', updatedAt: 'n' },
      {
        id: 'xliff',
        name: 'Bi',
        sourceLang: 'en',
        targetLang: 'pt',
        createdAt: 'n',
        updatedAt: 'n',
        bilingualMeta: { format: 'xliff12' },
      },
    ])
    await v5.table('segments').bulkAdd([
      { id: 's0', projectId: 'mono', index: 0, source: 'Title', target: '', status: 'untranslated', sourceMeta: { kind: 'heading', blockIndex: 0, sentenceIndex: 0 }, createdAt: 'n', updatedAt: 'n' },
      { id: 's1', projectId: 'mono', index: 1, source: 'A.', target: '', status: 'untranslated', sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 0 }, createdAt: 'n', updatedAt: 'n' },
      { id: 's2', projectId: 'mono', index: 2, source: 'B.', target: '', status: 'untranslated', sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 1 }, createdAt: 'n', updatedAt: 'n' },
      // XLIFF segment: no sourceMeta.
      { id: 'x0', projectId: 'xliff', index: 0, source: 'x', target: '', status: 'untranslated', createdAt: 'n', updatedAt: 'n' },
    ])
    v5.close()

    const v6 = openV6()
    // One document for the monolingual project, none for the XLIFF one.
    const doc = await v6.table('documents').where('projectId').equals('mono').first()
    expect(doc).toBeDefined()
    expect(await v6.table('documents').where('projectId').equals('xliff').first()).toBeUndefined()

    // Two blocks (heading + paragraph), ordered.
    const blocks = await v6.table('blocks').where('projectId').equals('mono').sortBy('index')
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph'])

    // Segments got their blockId; the two paragraph sentences share one block.
    const s1 = await v6.table('segments').get('s1')
    const s2 = await v6.table('segments').get('s2')
    const s0 = await v6.table('segments').get('s0')
    expect(s1.blockId).toBe(s2.blockId)
    expect(s0.blockId).not.toBe(s1.blockId)
    expect(blocks.map((b) => b.id).sort()).toEqual([s0.blockId, s1.blockId].sort())

    // The XLIFF segment is untouched.
    expect((await v6.table('segments').get('x0')).blockId).toBeUndefined()
    v6.close()
  })
})
