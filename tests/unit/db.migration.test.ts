import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateTemplatesToOwnTable } from '@/storage/db'

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
