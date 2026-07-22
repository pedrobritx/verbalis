import { db } from '@/storage/db'
import type { GlossaryEntry } from '@/core/types'
import { recordTombstone, notifyResourceChange } from '@/storage/cloud/rowSyncState'

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

/** Stamp the sync clock on a row being written locally (3.4). */
function stamped<T extends { updatedAt?: number }>(entry: T): T {
  return { ...entry, updatedAt: Date.now() }
}

/** Record tombstones for deleted rows, then fan out one change. */
async function tombstoneAndNotify(ids: string[]): Promise<void> {
  for (const id of ids) await recordTombstone('glossary', id)
  notifyResourceChange('glossary')
}

export const glossaryRepo = {
  getAll: () => db.glossary.toArray(),
  getById: (id: string) => db.glossary.get(id),
  create: (entry: GlossaryEntry) => {
    const p = db.glossary.add(stamped(entry))
    notifyResourceChange('glossary')
    return p
  },
  update: (id: string, changes: Partial<GlossaryEntry>) => {
    const p = db.glossary.update(id, { ...changes, updatedAt: Date.now() })
    notifyResourceChange('glossary')
    return p
  },
  remove: async (id: string) => {
    await recordTombstone('glossary', id)
    await db.glossary.delete(id)
    notifyResourceChange('glossary')
  },
  removeMany: async (ids: string[]) => {
    await db.glossary.bulkDelete(ids)
    await tombstoneAndNotify(ids)
  },
  bulkAdd: (entries: GlossaryEntry[]) => {
    const p = db.glossary.bulkAdd(entries.map(stamped))
    notifyResourceChange('glossary')
    return p
  },
  bulkPut: (entries: GlossaryEntry[]) => {
    const p = db.glossary.bulkPut(entries.map(stamped))
    notifyResourceChange('glossary')
    return p
  },
  byProject: (projectId: string) => db.glossary.where({ projectId }).toArray(),
  // Returns entries available in a given project: project-scoped + unassigned (global).
  byProjectOrGlobal: async (projectId: string): Promise<GlossaryEntry[]> => {
    const all = await db.glossary.toArray()
    return all.filter((e) => !e.projectId || e.projectId === projectId)
  },
  findByTerm: async (term: string, projectId?: string): Promise<GlossaryEntry | undefined> => {
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
        updatedAt: Date.now(),
      })
      notifyResourceChange('glossary')
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
      updatedAt: Date.now(),
    })
    notifyResourceChange('glossary')
    return id
  },
}
