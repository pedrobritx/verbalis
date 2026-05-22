import { db } from '@/storage/db'
import type { TMEntry } from '@/core/types'

export const tmRepo = {
  getAll: () => db.tm.toArray(),
  getById: (id: string) => db.tm.get(id),
  create: (entry: TMEntry) => db.tm.add(entry),
  update: (id: string, changes: Partial<TMEntry>) => db.tm.update(id, changes),
  remove: (id: string) => db.tm.delete(id),
  byLangPair: (sourceLang: string, targetLang: string) =>
    db.tm.where({ sourceLang, targetLang }).toArray(),
}
