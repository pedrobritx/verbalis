import Dexie from 'dexie'
import * as Y from 'yjs'
import { db } from '@/storage/db'
import type { ProjectVersion, Segment, SegmentStatus } from '@/core/types'
import { peekProjectDoc } from '@/storage/sync/docManager'
import { readAllSegments, readSegment } from '@/storage/sync/segmentCrdt'
import { segmentRepo } from './segmentRepo'
import { getProfileSettings, ensureLocalAuthor } from './settingsRepo'

/**
 * Project version history (Foundation F2).
 *
 * A version is a self-contained `Y.encodeStateAsUpdateV2` blob of the project's
 * Yjs doc at capture time, stored in the `versions` Dexie table. Restoring a
 * version routes the snapshot's segments *back through Dexie* (not by swapping
 * the live doc), so Dexie stays the single source of truth, the editor updates
 * reactively via `useLiveQuery`, and the bridge re-mirrors the result into the
 * live doc. Restores always capture a snapshot first, so they are reversible.
 */

/** One auto-snapshot per project per this interval at most. */
export const AUTO_THROTTLE_MS = 5 * 60 * 1000
/** Keep at most this many auto-snapshots per project; older ones are pruned. */
export const AUTO_KEEP = 50

/** Last auto-snapshot wall-clock time per project (in-memory throttle). */
const lastAuto = new Map<string, number>()

/** A single point in a segment's history, derived from version snapshots. */
export interface SegmentHistoryEntry {
  versionId: string
  versionLabel?: string
  kind: ProjectVersion['kind']
  author?: string
  createdAt: string
  target: string
  status: SegmentStatus
}

/** The most recent target change of a segment, for the project-wide Changes view. */
export interface ChangeEntry {
  segmentId: string
  index: number
  /** The previous distinct target (what the change replaced). */
  before: string
  /** The current target at the change. */
  after: string
  /** Who captured the version that introduced the change, if known. */
  author?: string
  createdAt: string
}

function encodeDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc)
}

function decodeToDoc(snapshot: Uint8Array): Y.Doc {
  const doc = new Y.Doc({ gc: true })
  Y.applyUpdateV2(doc, snapshot)
  return doc
}

/** Capture the current live doc into a version row. Null if no doc is open. */
async function capture(
  projectId: string,
  kind: ProjectVersion['kind'],
  label?: string,
  liveDoc?: Y.Doc,
  signOff = false,
  // Caller-resolved, account-aware display name (see features/account/displayName).
  // The storage layer stays account-agnostic; when omitted, the device-local
  // name is used. `authorId` is always the local identity (D8).
  resolvedName?: string,
): Promise<ProjectVersion | null> {
  const doc = liveDoc ?? peekProjectDoc(projectId)
  if (!doc) return null
  const segments = readAllSegments(doc, projectId)
  const profile = await getProfileSettings()
  // The same stable identity that attributes marks, comments, and presence (§5.3).
  const { authorId, authorName } = await ensureLocalAuthor()
  const name = resolvedName?.trim() || authorName
  const createdAt = new Date().toISOString()
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    projectId,
    kind,
    label: label?.trim() ? label.trim() : undefined,
    snapshot: encodeDoc(doc),
    segmentCount: segments.length,
    author: resolvedName?.trim() || profile.displayName || undefined,
    authorId,
    approval: signOff ? { authorId, authorName: name, at: createdAt } : undefined,
    createdAt,
  }
  await db.versions.add(version)
  return version
}

/** Versions for a project, oldest first (by the [projectId+createdAt] index). */
function listAsc(projectId: string): Promise<ProjectVersion[]> {
  return db.versions
    .where('[projectId+createdAt]')
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .toArray()
}

export const versionRepo = {
  /** Manual "Save version" with a label. */
  saveNamed: (projectId: string, label: string, liveDoc?: Y.Doc, resolvedName?: string) =>
    capture(projectId, 'named', label, liveDoc, false, resolvedName),

  /**
   * Revisor / PM **sign-off** (ROADMAP §5.3): a labeled `named` version stamped
   * with an `approval` (who + when), marking an approval milestone in the
   * timeline. Gating (who may sign off) is enforced at the call site via the
   * workflow rules; this only records it.
   */
  signOff: async (
    projectId: string,
    liveDoc?: Y.Doc,
    resolvedName?: string,
  ): Promise<ProjectVersion | null> => {
    const name = resolvedName?.trim() || (await ensureLocalAuthor()).authorName
    return capture(projectId, 'named', `Approved by ${name}`, liveDoc, true, name)
  },

  /**
   * Throttled safety-net snapshot. No-ops if one was taken for this project
   * within {@link AUTO_THROTTLE_MS}. Prunes old auto-snapshots on success.
   */
  maybeAutoSnapshot: async (projectId: string, liveDoc?: Y.Doc): Promise<ProjectVersion | null> => {
    const now = Date.now()
    if (now - (lastAuto.get(projectId) ?? 0) < AUTO_THROTTLE_MS) return null
    const version = await capture(projectId, 'auto', undefined, liveDoc)
    if (version) {
      lastAuto.set(projectId, now)
      await versionRepo.pruneAuto(projectId)
    }
    return version
  },

  /** Versions for a project, newest first (for the timeline UI). */
  listByProject: async (projectId: string): Promise<ProjectVersion[]> =>
    (await listAsc(projectId)).reverse(),

  /** Delete auto-snapshots beyond the retention cap, oldest first. */
  pruneAuto: async (projectId: string): Promise<void> => {
    const autos = (await listAsc(projectId)).filter((v) => v.kind === 'auto')
    if (autos.length <= AUTO_KEEP) return
    const stale = autos.slice(0, autos.length - AUTO_KEEP).map((v) => v.id)
    await db.versions.bulkDelete(stale)
  },

  /**
   * Restore the whole project to a version. Captures the current state first
   * (reversible), then replaces the project's segments via Dexie so the bridge
   * re-mirrors them into the live doc. Returns false if the version is missing.
   */
  restoreProject: async (projectId: string, versionId: string): Promise<boolean> => {
    const version = await db.versions.get(versionId)
    if (!version || version.projectId !== projectId) return false

    // Snapshot-before-restore: force-capture (bypass throttle) so a rollback can
    // itself be rolled back. Best-effort — only possible while a doc is open.
    await capture(projectId, 'auto', undefined)

    const snapDoc = decodeToDoc(version.snapshot)
    const restored = readAllSegments(snapDoc, projectId)
    snapDoc.destroy()

    await db.transaction('rw', db.segments, async () => {
      await db.segments.where('projectId').equals(projectId).delete()
      if (restored.length > 0) await db.segments.bulkAdd(restored)
    })
    return true
  },

  /** Restore a single segment to its state in a version. */
  restoreSegment: async (
    projectId: string,
    segmentId: string,
    versionId: string,
  ): Promise<boolean> => {
    const version = await db.versions.get(versionId)
    if (!version || version.projectId !== projectId) return false

    const snapDoc = decodeToDoc(version.snapshot)
    const snap = readSegment(snapDoc, projectId, segmentId)
    snapDoc.destroy()
    if (!snap) return false

    const current = await segmentRepo.getById(segmentId)
    if (!current) return false

    // Snapshot-before-restore so the single-segment rollback is undoable too.
    await capture(projectId, 'auto', undefined)

    // Restore only the mirrored, user-editable fields; undefined values clear
    // the property (Dexie semantics), e.g. removing a targetRich that the
    // restored version did not have.
    const changes: Partial<Segment> = {
      target: snap.target,
      targetRich: snap.targetRich,
      status: snap.status,
      locked: snap.locked,
      note: snap.note,
      comments: snap.comments,
    }
    await segmentRepo.update(segmentId, changes)
    return true
  },

  /**
   * The history of one segment, newest first, with consecutive identical
   * (status + target) states collapsed so each entry marks an actual change.
   */
  segmentTimeline: async (
    projectId: string,
    segmentId: string,
  ): Promise<SegmentHistoryEntry[]> => {
    const versions = await listAsc(projectId)
    const out: SegmentHistoryEntry[] = []
    let prevKey: string | null = null
    for (const v of versions) {
      const doc = decodeToDoc(v.snapshot)
      const seg = readSegment(doc, projectId, segmentId)
      doc.destroy()
      if (!seg) continue
      const key = `${seg.status} ${seg.target}`
      if (key === prevKey) continue
      prevKey = key
      out.push({
        versionId: v.id,
        versionLabel: v.label,
        kind: v.kind,
        author: v.author,
        createdAt: v.createdAt,
        target: seg.target,
        status: seg.status,
      })
    }
    return out.reverse()
  },

  /**
   * Project-wide tracked changes: for every segment that changed, its most recent
   * target change (before/after) attributed to the version that introduced it.
   * Walks all snapshots once (oldest→newest), tracking each segment's last
   * distinct target; a segment's first appearance is the baseline, not a change,
   * so an import isn't reported. Ordered by segment index.
   */
  latestChanges: async (projectId: string): Promise<ChangeEntry[]> => {
    const versions = await listAsc(projectId)
    const prevTarget = new Map<string, string>()
    const changes = new Map<string, ChangeEntry>()
    for (const v of versions) {
      const doc = decodeToDoc(v.snapshot)
      const segs = readAllSegments(doc, projectId)
      doc.destroy()
      for (const seg of segs) {
        const before = prevTarget.get(seg.id)
        if (before === undefined) {
          prevTarget.set(seg.id, seg.target)
          continue
        }
        if (before !== seg.target) {
          changes.set(seg.id, {
            segmentId: seg.id,
            index: seg.index,
            before,
            after: seg.target,
            author: v.author,
            createdAt: v.createdAt,
          })
          prevTarget.set(seg.id, seg.target)
        }
      }
    }
    return Array.from(changes.values()).sort((a, b) => a.index - b.index)
  },

  /** Remove all versions for a project (used by project cascade delete). */
  deleteByProject: (projectId: string): Promise<number> =>
    db.versions.where('projectId').equals(projectId).delete(),

  /** Test-only: clear the in-memory auto-snapshot throttle. */
  __resetThrottleForTest: (): void => {
    lastAuto.clear()
  },
}
