import { db } from '@/storage/db'
import type { Project } from '@/core/types'

export const projectRepo = {
  getAll: () => db.projects.orderBy('updatedAt').reverse().toArray(),
  getById: (id: string) => db.projects.get(id),
  create: (project: Project) => db.projects.add(project),
  update: (id: string, changes: Partial<Project>) => db.projects.update(id, changes),
  remove: (id: string) => db.projects.delete(id),
}
