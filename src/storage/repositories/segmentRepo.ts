import { db } from '@/storage/db'
import type { Segment, SegmentStatus } from '@/core/types'

export type StatusCounts = Record<SegmentStatus, number>

const ZERO_COUNTS: StatusCounts = {
  untranslated: 0,
  draft: 0,
  translated: 0,
  reviewed: 0,
  locked: 0,
}

export const segmentRepo = {
  byProject: (projectId: string) =>
    db.segments.where('projectId').equals(projectId).sortBy('index'),

  getById: (id: string) => db.segments.get(id),

  bulkCreate: (segments: Segment[]) => db.segments.bulkAdd(segments),

  update: (id: string, changes: Partial<Segment>) =>
    db.segments.update(id, { ...changes, updatedAt: new Date().toISOString() }),

  removeByProject: (projectId: string) =>
    db.segments.where('projectId').equals(projectId).delete(),

  countByStatus: async (projectId: string): Promise<StatusCounts> => {
    const rows = await db.segments.where('projectId').equals(projectId).toArray()
    const counts = { ...ZERO_COUNTS }
    for (const r of rows) counts[r.status] += 1
    return counts
  },
}
