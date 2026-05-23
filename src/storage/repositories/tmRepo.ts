import { db } from '@/storage/db'
import type { TMEntry } from '@/core/types'

export interface TMUpsertInput {
  source: string
  target: string
  sourceLang: string
  targetLang: string
  projectId?: string
}

export const tmRepo = {
  getAll: () => db.tm.toArray(),
  getById: (id: string) => db.tm.get(id),
  create: (entry: TMEntry) => db.tm.add(entry),
  update: (id: string, changes: Partial<TMEntry>) => db.tm.update(id, changes),
  remove: (id: string) => db.tm.delete(id),
  removeMany: (ids: string[]) => db.tm.bulkDelete(ids),
  bulkAdd: (entries: TMEntry[]) => db.tm.bulkAdd(entries),
  byLangPair: (sourceLang: string, targetLang: string) =>
    db.tm.where({ sourceLang, targetLang }).toArray(),
  findExact: (source: string, sourceLang: string, targetLang: string) =>
    db.tm.where({ source, sourceLang, targetLang }).first(),
  // Upsert by (source, sourceLang, targetLang). Cross-project duplicates are intentionally
  // overwritten — TM is global by language pair (see plan).
  upsert: async (input: TMUpsertInput): Promise<string> => {
    const existing = await db.tm
      .where({ source: input.source, sourceLang: input.sourceLang, targetLang: input.targetLang })
      .first()
    const now = new Date().toISOString()
    if (existing) {
      await db.tm.update(existing.id, {
        target: input.target,
        date: now,
        projectId: input.projectId,
      })
      return existing.id
    }
    const id = crypto.randomUUID()
    await db.tm.add({
      id,
      source: input.source,
      target: input.target,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      projectId: input.projectId,
      date: now,
    })
    return id
  },
}
