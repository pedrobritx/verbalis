import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { extractChanges, type ExtractedChange } from '@/core/changes/extract'
import {
  resolveChangeInRich,
  resolveAllInRich,
  type ResolveAction,
} from '../rich/resolve'

/**
 * Orchestrates accept/reject on stored segments. Kept in the feature layer (not
 * segmentRepo) so the storage layer never imports the Lexical node the headless
 * resolver constructs. Every write goes through `segmentRepo.update`, so the
 * Dexie→Yjs bridge and version history observe the resolution like any edit.
 */

/** A pending suggestion plus the segment it belongs to, for project-wide views. */
export interface PendingChange extends ExtractedChange {
  segmentId: string
  segmentIndex: number
}

/** Resolve a single change in one segment. Returns true when it was applied. */
export async function resolveSegmentChange(
  segmentId: string,
  changeId: string,
  action: ResolveAction,
): Promise<boolean> {
  const seg = await segmentRepo.getById(segmentId)
  if (!seg?.targetRich) return false
  const next = resolveChangeInRich(seg.targetRich, changeId, action)
  if (!next) return false
  await segmentRepo.update(segmentId, { targetRich: next.targetRich, target: next.target })
  return true
}

/** Resolve every pending change in one segment. Returns the count applied. */
export async function resolveSegmentAll(
  segmentId: string,
  action: ResolveAction,
): Promise<number> {
  const seg = await segmentRepo.getById(segmentId)
  if (!seg?.targetRich) return 0
  const next = resolveAllInRich(seg.targetRich, action)
  if (!next) return 0
  await segmentRepo.update(segmentId, { targetRich: next.targetRich, target: next.target })
  return next.count
}

/** List every pending suggestion across a project's segments, in reading order. */
export async function listPendingChanges(projectId: string): Promise<PendingChange[]> {
  const segments = await segmentRepo.byProject(projectId)
  const out: PendingChange[] = []
  for (const seg of segments) {
    if (!seg.targetRich) continue
    for (const change of extractChanges(seg.targetRich)) {
      out.push({ ...change, segmentId: seg.id, segmentIndex: seg.index })
    }
  }
  return out
}

/** Resolve every pending change in a whole project. Returns the count applied. */
export async function resolveProjectAll(
  projectId: string,
  action: ResolveAction,
): Promise<number> {
  const segments = await segmentRepo.byProject(projectId)
  let total = 0
  for (const seg of segments) {
    if (!seg.targetRich) continue
    const next = resolveAllInRich(seg.targetRich, action)
    if (next) {
      await segmentRepo.update(seg.id, { targetRich: next.targetRich, target: next.target })
      total += next.count
    }
  }
  return total
}
