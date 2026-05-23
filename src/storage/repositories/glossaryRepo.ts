import { db } from '@/storage/db'
import type { GlossaryEntry } from '@/core/types'

export interface GlossaryUpsertInput {
  term: string
  definition: string
  translations: Record<string, string>
  notes?: string
  projectId?: string
}

function normalizeTerm(term: string): string {
  return term.normalize('NFC').toLowerCase().trim()
}

export const glossaryRepo = {
  getAll: () => db.glossary.toArray(),
  getById: (id: string) => db.glossary.get(id),
  create: (entry: GlossaryEntry) => db.glossary.add(entry),
  update: (id: string, changes: Partial<GlossaryEntry>) => db.glossary.update(id, changes),
  remove: (id: string) => db.glossary.delete(id),
  removeMany: (ids: string[]) => db.glossary.bulkDelete(ids),
  bulkAdd: (entries: GlossaryEntry[]) => db.glossary.bulkAdd(entries),
  byProject: (projectId: string) => db.glossary.where({ projectId }).toArray(),
  // Returns entries available in a given project: project-scoped + unassigned (global).
  byProjectOrGlobal: async (projectId: string): Promise<GlossaryEntry[]> => {
    const all = await db.glossary.toArray()
    return all.filter((e) => !e.projectId || e.projectId === projectId)
  },
  findByTerm: async (
    term: string,
    projectId?: string,
  ): Promise<GlossaryEntry | undefined> => {
    const needle = normalizeTerm(term)
    if (!needle) return undefined
    const rows = projectId
      ? await db.glossary.where({ projectId }).toArray()
      : await db.glossary.toArray()
    return rows.find((e) => normalizeTerm(e.term) === needle)
  },
  // Upsert by (normalized term, projectId). Merges translations on collision.
  upsert: async (input: GlossaryUpsertInput): Promise<string> => {
    const existing = await glossaryRepo.findByTerm(input.term, input.projectId)
    if (existing) {
      const merged: Record<string, string> = {
        ...existing.translations,
        ...input.translations,
      }
      await db.glossary.update(existing.id, {
        definition: input.definition || existing.definition,
        translations: merged,
        notes: input.notes ?? existing.notes,
      })
      return existing.id
    }
    const id = crypto.randomUUID()
    await db.glossary.add({
      id,
      term: input.term,
      definition: input.definition,
      translations: input.translations,
      notes: input.notes,
      projectId: input.projectId,
    })
    return id
  },
}
