import type * as Y from 'yjs'
import { db } from '@/storage/db'
import type { Segment } from '@/core/types'
import { applyCreate, applyDelete, applyUpdate } from './segmentCrdt'

/**
 * Dexie→Yjs mirror (Foundation F2).
 *
 * Dexie hooks fire for *every* segment mutation path — `update`, `bulkAdd`,
 * `bulkPut`, `delete`, and the transactions inside `splitSegment`/`joinWithNext`
 * and the comment ops — so the project's Yjs doc stays in sync without touching
 * a single call site. For single-user this is the only direction data flows
 * (Dexie is the source of truth), so feedback loops are structurally impossible;
 * each write is tagged `ORIGIN_DEXIE` inside the model helpers so F3's reverse
 * observer can ignore them.
 *
 * The doc for a project is resolved lazily: if a project's doc isn't currently
 * open (its editor isn't mounted), the hook is a no-op. The resolver is injected
 * so the bridge can be unit-tested with an in-memory doc, with no IndexedDB.
 */

export type DocResolver = (projectId: string) => Y.Doc | null

let resolveDoc: DocResolver = () => null
let installed = false

/**
 * Depth counter for {@link withMirrorSuppressed}. While > 0 the Dexie→Yjs hooks
 * are inert: the reverse observer (F3) writes remote changes into Dexie that are
 * *already* in the doc, so re-mirroring them is redundant — and, because
 * `segmentRepo.update` bumps `updatedAt`, would otherwise produce a tiny
 * doc change that the session would re-broadcast, ping-ponging across peers.
 * Suppressing the mirror for the reverse write breaks that loop at the source.
 */
let mirrorSuppressed = 0

/** Wire the resolver the hooks use to find a project's live doc. */
export function setDocResolver(resolver: DocResolver): void {
  resolveDoc = resolver
}

/**
 * Run `fn` with the Dexie→Yjs mirror suppressed. Used by the reverse observer
 * around its Dexie writes. Reference-counted so nested calls are safe.
 */
export async function withMirrorSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  mirrorSuppressed += 1
  try {
    return await fn()
  } finally {
    mirrorSuppressed -= 1
  }
}

/** Install the Dexie hooks once. Idempotent. */
export function installSegmentBridge(): void {
  if (installed) return
  installed = true

  db.segments.hook('creating', (_pk, seg) => {
    if (mirrorSuppressed > 0) return
    const doc = resolveDoc((seg as Segment).projectId)
    if (doc) applyCreate(doc, seg as Segment)
  })

  db.segments.hook('updating', (mods, _pk, seg) => {
    if (mirrorSuppressed > 0) return
    const next = { ...(seg as Segment), ...(mods as Partial<Segment>) } as Segment
    const doc = resolveDoc(next.projectId)
    if (doc) applyUpdate(doc, next)
  })

  db.segments.hook('deleting', (_pk, seg) => {
    if (mirrorSuppressed > 0) return
    const row = seg as Segment | undefined
    if (!row) return
    const doc = resolveDoc(row.projectId)
    if (doc) applyDelete(doc, row.id)
  })
}

/** Test-only: reset the install guard so a suite can re-install cleanly. */
export function __resetBridgeForTest(): void {
  installed = false
  resolveDoc = () => null
  mirrorSuppressed = 0
}
