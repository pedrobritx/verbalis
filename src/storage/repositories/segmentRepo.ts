import { db } from '@/storage/db'
import type { Segment, SegmentComment, SegmentStatus } from '@/core/types'
import { canJoin, mergeStatus, splitSourceText } from '@/core/segments/operations'

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

  /** Toggle the orthogonal lock flag (read-only + excluded from batch ops). */
  setLocked: (id: string, locked: boolean) =>
    db.segments.update(id, { locked: locked || undefined, updatedAt: new Date().toISOString() }),

  /**
   * Split a segment at `offset` in its source. The original keeps the left part
   * and its existing target; a new untranslated segment holds the right part.
   * All following segments shift up by one index, atomically. Returns the new
   * segment's id, or null when the offset doesn't yield two non-empty sides.
   */
  splitSegment: (projectId: string, segmentId: string, offset: number): Promise<string | null> =>
    db.transaction('rw', db.segments, async () => {
      const rows = await db.segments.where('projectId').equals(projectId).sortBy('index')
      const pos = rows.findIndex((s) => s.id === segmentId)
      if (pos < 0) return null
      const seg = rows[pos]
      const parts = splitSourceText(seg.source, offset)
      if (!parts) return null

      const now = new Date().toISOString()
      const newSeg: Segment = {
        id: crypto.randomUUID(),
        projectId,
        index: seg.index + 1,
        source: parts.right,
        target: '',
        status: 'untranslated',
        sourceMeta: seg.sourceMeta ? { ...seg.sourceMeta } : undefined,
        createdAt: now,
        updatedAt: now,
      }

      const updated: Segment[] = [{ ...seg, source: parts.left, updatedAt: now }]
      for (let i = pos + 1; i < rows.length; i += 1) {
        updated.push({ ...rows[i], index: rows[i].index + 1, updatedAt: now })
      }
      updated.push(newSeg)
      await db.segments.bulkPut(updated)
      return newSeg.id
    }),

  /**
   * Join a segment with the one immediately after it (same source block only).
   * Sources and non-empty targets are concatenated with `separator`; the merged
   * status is the less-complete of the two. Following segments shift down by
   * one index. Returns true on success, false when there is no joinable next
   * segment.
   */
  joinWithNext: (projectId: string, segmentId: string, separator = ' '): Promise<boolean> =>
    db.transaction('rw', db.segments, async () => {
      const rows = await db.segments.where('projectId').equals(projectId).sortBy('index')
      const pos = rows.findIndex((s) => s.id === segmentId)
      if (pos < 0 || pos + 1 >= rows.length) return false
      const a = rows[pos]
      const b = rows[pos + 1]
      if (!canJoin(a, b)) return false

      const now = new Date().toISOString()
      const target = [a.target, b.target]
        .map((t) => t.trim())
        .filter(Boolean)
        .join(separator)

      const updated: Segment[] = [
        {
          ...a,
          source: `${a.source}${separator}${b.source}`,
          target,
          status: mergeStatus(a.status, b.status),
          locked: a.locked || b.locked || undefined,
          updatedAt: now,
        },
      ]
      for (let i = pos + 2; i < rows.length; i += 1) {
        updated.push({ ...rows[i], index: rows[i].index - 1, updatedAt: now })
      }
      await db.segments.bulkPut(updated)
      await db.segments.delete(b.id)
      return true
    }),
}
