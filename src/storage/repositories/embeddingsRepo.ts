import { db } from '@/storage/db'
import type { EmbeddingRecord } from '@/core/types'

export const embeddingsRepo = {
  getByTmId: (tmId: string, model: string) =>
    db.embeddings.where('[tmId+model]').equals([tmId, model]).first(),
  bulkUpsert: (records: EmbeddingRecord[]) => db.embeddings.bulkPut(records),
  deleteByModel: (model: string) => db.embeddings.where('model').equals(model).delete(),
  byModel: (model: string) => db.embeddings.where('model').equals(model).toArray(),
  count: (model: string) => db.embeddings.where('model').equals(model).count(),
  countAll: () => db.embeddings.count(),
  clear: () => db.embeddings.clear(),
}
