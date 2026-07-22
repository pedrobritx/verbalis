import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/storage/db'
import { documentRepo, blockRepo } from '@/storage/repositories/documentRepo'
import type { Block, DocumentEntity } from '@/core/documents/model'

const now = 'now'

function doc(projectId: string): DocumentEntity {
  return {
    id: `doc-${projectId}`,
    projectId,
    name: 'Doc',
    sourceFormat: 'md',
    createdAt: now,
    updatedAt: now,
  }
}

function block(documentId: string, projectId: string, index: number): Block {
  return { id: `blk-${documentId}-${index}`, documentId, projectId, index, kind: 'paragraph' }
}

beforeEach(async () => {
  await db.documents.clear()
  await db.blocks.clear()
})

describe('documentRepo / blockRepo', () => {
  it('stores and reads a project document', async () => {
    await documentRepo.create(doc('p1'))
    expect(await documentRepo.getByProject('p1')).toMatchObject({
      projectId: 'p1',
      sourceFormat: 'md',
    })
    expect(await documentRepo.getByProject('nope')).toBeUndefined()
  })

  it('reads blocks for a document in index order', async () => {
    // Insert out of order; expect ordered read.
    await blockRepo.bulkCreate([
      block('doc-p1', 'p1', 2),
      block('doc-p1', 'p1', 0),
      block('doc-p1', 'p1', 1),
    ])
    const ordered = await blockRepo.byDocument('doc-p1')
    expect(ordered.map((b) => b.index)).toEqual([0, 1, 2])
  })

  it('scopes and removes blocks/documents by project', async () => {
    await documentRepo.create(doc('p1'))
    await documentRepo.create(doc('p2'))
    await blockRepo.bulkCreate([block('doc-p1', 'p1', 0), block('doc-p2', 'p2', 0)])

    expect(await blockRepo.byProject('p1')).toHaveLength(1)
    await documentRepo.removeByProject('p1')
    await blockRepo.removeByProject('p1')
    expect(await documentRepo.getByProject('p1')).toBeUndefined()
    expect(await blockRepo.byProject('p1')).toHaveLength(0)
    // p2 untouched.
    expect(await documentRepo.getByProject('p2')).toBeDefined()
    expect(await blockRepo.byProject('p2')).toHaveLength(1)
  })
})
