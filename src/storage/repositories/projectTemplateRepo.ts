import { db } from '@/storage/db'

/**
 * The original bilingual document for an XLIFF project, stored apart from the
 * (lightweight) project row so listing projects never loads these blobs. Only
 * touched on import (write), duplicate (copy) and export (read).
 */
export const projectTemplateRepo = {
  get: async (projectId: string): Promise<string | undefined> =>
    (await db.projectTemplates.get(projectId))?.templateXml,

  put: (projectId: string, templateXml: string) =>
    db.projectTemplates.put({ projectId, templateXml }),

  remove: (projectId: string) => db.projectTemplates.delete(projectId),
}
