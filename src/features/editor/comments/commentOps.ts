import { segmentRepo } from '@/storage/repositories/segmentRepo'
import type { SegmentComment } from '@/core/types'
import { removeCommentMark } from '../rich/comments'

/**
 * Comment thread orchestration (Phase 1.5). Comments stay inline on the segment
 * (SegmentComment[]); a "thread" is a root comment (no parentId) plus its
 * replies. Anchored roots carry an `anchorId` linking to a CommentMarkNode in
 * `targetRich`. Resolving/deleting a thread also drops the anchor highlight via
 * the headless `removeCommentMark`, routed through `segmentRepo.update` so the
 * Dexie→Yjs bridge and version history observe it.
 */

export interface CommentThread {
  root: SegmentComment
  replies: SegmentComment[]
}

/** A thread plus the segment it belongs to, for project-wide views. */
export interface ProjectThread extends CommentThread {
  segmentId: string
  segmentIndex: number
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  return c?.randomUUID
    ? c.randomUUID()
    : `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Group a segment's flat comments into threads (roots + their replies), in order. */
export function groupThreads(comments: SegmentComment[] | undefined): CommentThread[] {
  const list = comments ?? []
  const roots = list.filter((c) => !c.parentId)
  const repliesByParent = new Map<string, SegmentComment[]>()
  for (const c of list) {
    if (!c.parentId) continue
    const arr = repliesByParent.get(c.parentId) ?? []
    arr.push(c)
    repliesByParent.set(c.parentId, arr)
  }
  return roots.map((root) => ({
    root,
    replies: (repliesByParent.get(root.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  }))
}

/** Add a root comment (optionally anchored to a highlighted range). */
export async function addRootComment(
  segmentId: string,
  body: string,
  author: string | undefined,
  anchor?: { anchorId: string; quote: string },
): Promise<SegmentComment> {
  const comment: SegmentComment = {
    id: newId(),
    body,
    author: author?.trim() || undefined,
    createdAt: new Date().toISOString(),
    ...(anchor ? { anchorId: anchor.anchorId, quote: anchor.quote } : {}),
  }
  await segmentRepo.addComment(segmentId, comment)
  return comment
}

/** Add a reply to a root comment. */
export async function addReply(
  segmentId: string,
  parentId: string,
  body: string,
  author: string | undefined,
): Promise<SegmentComment> {
  const comment: SegmentComment = {
    id: newId(),
    body,
    author: author?.trim() || undefined,
    createdAt: new Date().toISOString(),
    parentId,
  }
  await segmentRepo.addComment(segmentId, comment)
  return comment
}

/** Set a root thread resolved/reopened; resolving drops its anchor highlight. */
export async function setThreadResolved(
  segmentId: string,
  root: SegmentComment,
  resolved: boolean,
): Promise<void> {
  await segmentRepo.updateComment(segmentId, root.id, { resolved })
  if (resolved && root.anchorId) await dropAnchor(segmentId, root.anchorId)
}

/** Delete a whole thread (root + replies) and its anchor highlight. */
export async function deleteThread(segmentId: string, thread: CommentThread): Promise<void> {
  for (const reply of thread.replies) await segmentRepo.deleteComment(segmentId, reply.id)
  await segmentRepo.deleteComment(segmentId, thread.root.id)
  if (thread.root.anchorId) await dropAnchor(segmentId, thread.root.anchorId)
}

/** Remove an orphaned anchor highlight (e.g. cancelling the composer). */
export async function dropAnchor(segmentId: string, anchorId: string): Promise<void> {
  const seg = await segmentRepo.getById(segmentId)
  if (!seg?.targetRich) return
  const next = removeCommentMark(seg.targetRich, anchorId)
  if (next)
    await segmentRepo.update(segmentId, { targetRich: next.targetRich, target: next.target })
}

/** Every thread across a project's segments, in reading order. */
export async function listProjectThreads(projectId: string): Promise<ProjectThread[]> {
  const segments = await segmentRepo.byProject(projectId)
  const out: ProjectThread[] = []
  for (const seg of segments) {
    for (const thread of groupThreads(seg.comments)) {
      out.push({ ...thread, segmentId: seg.id, segmentIndex: seg.index })
    }
  }
  return out
}
