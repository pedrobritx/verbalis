import { db } from '@/storage/db'
import type { Segment, SegmentComment, SegmentStatus } from '@/core/types'

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

  // Comments are stored inline on the segment, so every mutation is a
  // read-modify-write inside a transaction to avoid clobbering a concurrent
  // edit to the same row.
  addComment: (id: string, comment: SegmentComment) =>
    db.transaction('rw', db.segments, async () => {
      const seg = await db.segments.get(id)
      if (!seg) return
      const comments = [...(seg.comments ?? []), comment]
      await db.segments.update(id, { comments, updatedAt: new Date().toISOString() })
    }),

  updateComment: (id: string, commentId: string, changes: Partial<SegmentComment>) =>
    db.transaction('rw', db.segments, async () => {
      const seg = await db.segments.get(id)
      if (!seg?.comments) return
      const comments = seg.comments.map((c) =>
        c.id === commentId ? { ...c, ...changes } : c,
      )
      await db.segments.update(id, { comments, updatedAt: new Date().toISOString() })
    }),

  deleteComment: (id: string, commentId: string) =>
    db.transaction('rw', db.segments, async () => {
      const seg = await db.segments.get(id)
      if (!seg?.comments) return
      const comments = seg.comments.filter((c) => c.id !== commentId)
      await db.segments.update(id, { comments, updatedAt: new Date().toISOString() })
    }),
}
