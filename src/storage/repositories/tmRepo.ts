import { db } from '@/storage/db'
import type { TMEntry } from '@/core/types'
import { recordTombstone, notifyResourceChange } from '@/storage/cloud/rowSyncState'

export interface TMUpsertInput {
  source: string
  target: string
  sourceLang: string
  targetLang: string
  projectId?: string
}

/** Stamp the sync clock on a row being written locally (3.4). */
function stamped(entry: TMEntry): TMEntry {
  return { ...entry, updatedAt: Date.now() }
}

export const tmRepo = {
  getAll: () => db.tm.toArray(),
  getById: (id: string) => db.tm.get(id),
  create: (entry: TMEntry) => {
    const p = db.tm.add(stamped(entry))
    notifyResourceChange('tm')
    return p
  },
  update: (id: string, changes: Partial<TMEntry>) => {
    const p = db.tm.update(id, { ...changes, updatedAt: Date.now() })
    notifyResourceChange('tm')
    return p
  },
  remove: async (id: string) => {
    await recordTombstone('tm', id)
    await db.tm.delete(id)
    notifyResourceChange('tm')
  },
  removeMany: async (ids: string[]) => {
    for (const id of ids) await recordTombstone('tm', id)
    await db.tm.bulkDelete(ids)
    notifyResourceChange('tm')
  },
  bulkAdd: (entries: TMEntry[]) => {
    const p = db.tm.bulkAdd(entries.map(stamped))
    notifyResourceChange('tm')
    return p
  },
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
        updatedAt: Date.now(),
      })
      notifyResourceChange('tm')
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
      updatedAt: Date.now(),
    })
    notifyResourceChange('tm')
    return id
  },
}
