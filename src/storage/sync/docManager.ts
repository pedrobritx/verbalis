import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { isSeeded, seedFromDexie } from './segmentCrdt'
import { installSegmentBridge, setDocResolver } from './bridge'

/**
 * Owns the lifecycle of per-project Yjs documents and their `y-indexeddb`
 * persistence providers. Docs are ref-counted so the editor and the version
 * history panel can share one project's doc without double-destroying it, and
 * are evicted once nothing holds them.
 *
 * The Dexie→Yjs bridge resolves a project's live doc through {@link peekProjectDoc},
 * so a doc only mirrors writes while it is open (acquired).
 */

interface DocEntry {
  doc: Y.Doc
  provider: IndexeddbPersistence
  refs: number
}

const cache = new Map<string, DocEntry>()

let bridgeWired = false

function wireBridgeOnce(): void {
  if (bridgeWired) return
  bridgeWired = true
  setDocResolver(peekProjectDoc)
  installSegmentBridge()
}

/** IndexedDB database name for a project's Yjs doc (separate from Dexie). */
function docKey(projectId: string): string {
  return `verbalis-yjs-${projectId}`
}

/**
 * Acquire (load + hydrate + seed) a project's doc, bumping its ref count.
 * Hydrates from IndexedDB, then seeds from Dexie on first ever open. The bridge
 * is wired on the first acquire so writes start mirroring immediately.
 */
export async function acquireProjectDoc(projectId: string): Promise<Y.Doc> {
  wireBridgeOnce()

  const existing = cache.get(projectId)
  if (existing) {
    existing.refs += 1
    await existing.provider.whenSynced
    return existing.doc
  }

  const doc = new Y.Doc({ gc: true })
  const provider = new IndexeddbPersistence(docKey(projectId), doc)
  // Register before awaiting so the bridge can already mirror concurrent writes.
  cache.set(projectId, { doc, provider, refs: 1 })

  await provider.whenSynced
  if (!isSeeded(doc)) {
    const segments = await segmentRepo.byProject(projectId)
    seedFromDexie(doc, projectId, segments)
  }
  return doc
}

/** Resolve a currently-open project's doc, or null. Used by the bridge. */
export function peekProjectDoc(projectId: string): Y.Doc | null {
  return cache.get(projectId)?.doc ?? null
}

/** Release one reference; destroys the doc + provider when the last is gone. */
export function releaseProjectDoc(projectId: string): void {
  const entry = cache.get(projectId)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs > 0) return
  entry.provider.destroy()
  entry.doc.destroy()
  cache.delete(projectId)
}
