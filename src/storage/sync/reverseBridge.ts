import * as Y from 'yjs'
import { db } from '@/storage/db'
import { getSegmentsMap, readSegment, ORIGIN_DEXIE } from './segmentCrdt'
import { withMirrorSuppressed } from './bridge'

/**
 * Yjs → Dexie reverse observer (Foundation F3).
 *
 * F2 mirrors Dexie into the per-project Yjs doc one way. F3 closes the loop:
 * updates arriving from peers are applied to the doc (tagged `ORIGIN_REMOTE`),
 * and this observer reconciles those changes back into Dexie — the source of
 * truth — so the editor's `useLiveQuery` reads, TM, QA and version history all
 * see merged peer edits with no new read paths.
 *
 * Loop safety: changes the local app already wrote into the doc carry
 * `ORIGIN_DEXIE` and are ignored here (they are already in Dexie). The Dexie
 * writes this observer performs run inside {@link withMirrorSuppressed}, so they
 * do not bounce back into the doc — the remote change is already there. Only
 * truly remote (or initial-state) transactions reach Dexie.
 */

type SegmentsEvent = Y.YEvent<Y.Map<unknown>>

/**
 * Observe a project's doc and write remote segment changes into Dexie. Returns
 * a disposer that detaches the observer.
 */
export function installReverseBridge(doc: Y.Doc, projectId: string): () => void {
  const segments = getSegmentsMap(doc)

  const observer = (events: SegmentsEvent[], txn: Y.Transaction) => {
    // Our own Dexie→Yjs mirror; the data is already in Dexie.
    if (txn.origin === ORIGIN_DEXIE) return

    const changed = new Set<string>()
    const removed = new Set<string>()

    for (const ev of events) {
      if (ev.target === segments) {
        // Top-level: segment added / replaced / deleted.
        ev.changes.keys.forEach((change, key) => {
          if (change.action === 'delete') removed.add(key)
          else changed.add(key)
        })
      } else {
        // Nested change (target text, a scalar field, a comment). The owning
        // segment id is the first path element under the segments map.
        const id = ev.path[0]
        if (typeof id === 'string') changed.add(id)
      }
    }

    if (changed.size === 0 && removed.size === 0) return

    void reconcile(doc, projectId, changed, removed)
  }

  segments.observeDeep(observer)
  return () => segments.unobserveDeep(observer)
}

async function reconcile(
  doc: Y.Doc,
  projectId: string,
  changed: Set<string>,
  removed: Set<string>,
): Promise<void> {
  await withMirrorSuppressed(async () => {
    for (const id of changed) {
      const seg = readSegment(doc, projectId, id)
      // `put` carries the doc's own `updatedAt`, so peers converge on one value
      // (last-writer-wins) instead of each bumping their own timestamp.
      if (seg) await db.segments.put(seg)
    }
    for (const id of removed) {
      await db.segments.delete(id)
    }
  })
}
