import { db } from '@/storage/db'
import type { Project, Segment } from '@/core/types'

export interface ProjectDeletionStats {
  segments: number
  /** TM entries scoped to this project (project-scoped, not global). */
  tmEntries: number
  /** Glossary entries scoped to this project. */
  glossaryEntries: number
}

export const projectRepo = {
  getAll: () => db.projects.orderBy('updatedAt').reverse().toArray(),
  getById: (id: string) => db.projects.get(id),
  create: (project: Project) => db.projects.add(project),

  // Edits always refresh updatedAt so the projects list stays ordered by
  // recency (callers may override by passing updatedAt explicitly).
  update: (id: string, changes: Partial<Project>) =>
    db.projects.update(id, { updatedAt: new Date().toISOString(), ...changes }),

  remove: (id: string) => db.projects.delete(id),

  /** Counts of data that a delete would touch, for the confirmation dialog. */
  deletionStats: async (id: string): Promise<ProjectDeletionStats> => {
    const [segments, tmEntries, glossaryEntries] = await Promise.all([
      db.segments.where('projectId').equals(id).count(),
      db.tm.where('projectId').equals(id).count(),
      db.glossary.where('projectId').equals(id).count(),
    ])
    return { segments, tmEntries, glossaryEntries }
  },

  /**
   * Delete a project and its segments. Project-scoped TM/glossary entries (and
   * their cached embeddings) are removed only when `deleteResources` is set —
   * by default they are preserved, since translation memory keeps its value
   * beyond a single project.
   */
  removeCascade: async (id: string, opts: { deleteResources?: boolean } = {}): Promise<void> => {
    await db.transaction(
      'rw',
      [db.projects, db.projectTemplates, db.segments, db.tm, db.glossary, db.embeddings, db.versions],
      async () => {
        await db.segments.where('projectId').equals(id).delete()
        await db.projectTemplates.delete(id)
        await db.versions.where('projectId').equals(id).delete()
        if (opts.deleteResources) {
          const tmIds = (await db.tm.where('projectId').equals(id).primaryKeys()) as string[]
          if (tmIds.length > 0) await db.embeddings.where('tmId').anyOf(tmIds).delete()
          await db.tm.where('projectId').equals(id).delete()
          await db.glossary.where('projectId').equals(id).delete()
        }
        await db.projects.delete(id)
      },
    )
  },

  /**
   * Clone a project and all of its segments under a new id (translations and
   * statuses are copied as-is). Returns the new project id.
   */
  duplicate: async (id: string, name?: string): Promise<string | null> => {
    const source = await db.projects.get(id)
    if (!source) return null
    const now = new Date().toISOString()
    const newId = crypto.randomUUID()
    const clone: Project = {
      ...source,
      id: newId,
      name: name?.trim() || `${source.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    }
    const segments = await db.segments.where('projectId').equals(id).toArray()
    const clonedSegments: Segment[] = segments.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      projectId: newId,
    }))
    const template = await db.projectTemplates.get(id)
    await db.transaction('rw', [db.projects, db.projectTemplates, db.segments], async () => {
      await db.projects.add(clone)
      if (clonedSegments.length > 0) await db.segments.bulkAdd(clonedSegments)
      if (template) await db.projectTemplates.put({ projectId: newId, templateXml: template.templateXml })
    })
    return newId
  },
}
