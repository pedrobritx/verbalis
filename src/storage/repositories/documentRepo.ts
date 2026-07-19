import { db } from '../db'
import type { DocumentEntity, Block, Asset } from '@/core/documents/model'

/** The document belonging to a project (monolingual projects have exactly one). */
export const documentRepo = {
  getByProject: (projectId: string) =>
    db.documents.where('projectId').equals(projectId).first(),

  getById: (id: string) => db.documents.get(id),

  create: (doc: DocumentEntity) => db.documents.put(doc),

  removeByProject: (projectId: string) =>
    db.documents.where('projectId').equals(projectId).delete(),
}

/** Structural blocks of a document, ordered by their index. */
export const blockRepo = {
  byDocument: (documentId: string) =>
    db.blocks
      .where('[documentId+index]')
      .between([documentId, -Infinity], [documentId, Infinity], true, true)
      .toArray(),

  byProject: (projectId: string) => db.blocks.where('projectId').equals(projectId).toArray(),

  bulkCreate: (blocks: Block[]) => db.blocks.bulkAdd(blocks),

  removeByProject: (projectId: string) =>
    db.blocks.where('projectId').equals(projectId).delete(),
}

/** Binary assets (embedded images, original file) referenced by a document. */
export const assetRepo = {
  getById: (id: string) => db.assets.get(id),

  byDocument: (documentId: string) => db.assets.where('documentId').equals(documentId).toArray(),

  create: (asset: Asset) => db.assets.put(asset),

  bulkCreate: (assets: Asset[]) => db.assets.bulkAdd(assets),

  removeByProject: (projectId: string) =>
    db.assets.where('projectId').equals(projectId).delete(),
}
