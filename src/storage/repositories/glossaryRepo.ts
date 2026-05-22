import { db } from '@/storage/db'
import type { GlossaryEntry } from '@/core/types'

export const glossaryRepo = {
  getAll: () => db.glossary.toArray(),
  getById: (id: string) => db.glossary.get(id),
  create: (entry: GlossaryEntry) => db.glossary.add(entry),
  update: (id: string, changes: Partial<GlossaryEntry>) => db.glossary.update(id, changes),
  remove: (id: string) => db.glossary.delete(id),
  byProject: (projectId: string) => db.glossary.where({ projectId }).toArray(),
}
