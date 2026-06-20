import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { acquireProjectDoc, releaseProjectDoc } from '@/storage/sync/docManager'
import { versionRepo } from '@/storage/repositories/versionRepo'

/**
 * Loads the project's Yjs doc for the lifetime of the editor (Foundation F2):
 * hydrates from IndexedDB, seeds from Dexie on first open, and drives the
 * throttled auto-snapshot safety net off the doc's `update` event. The doc is
 * ref-counted, so the editor and the history panel can both depend on it.
 *
 * Returns `ready` once the doc is hydrated; mirroring works regardless, this is
 * just so consumers can gate history actions on a loaded doc.
 */

/** Idle delay before a doc change schedules an auto-snapshot attempt. */
const AUTO_DEBOUNCE_MS = 2000

export function useProjectCrdt(projectId: string | undefined): { ready: boolean } {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    let doc: Y.Doc | null = null
    let debounce: ReturnType<typeof setTimeout> | null = null

    const onUpdate = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        // The repo throttles to at most one auto-snapshot per project per window.
        void versionRepo.maybeAutoSnapshot(projectId)
      }, AUTO_DEBOUNCE_MS)
    }

    setReady(false)
    void acquireProjectDoc(projectId).then((d) => {
      if (cancelled) {
        releaseProjectDoc(projectId)
        return
      }
      doc = d
      d.on('update', onUpdate)
      setReady(true)
    })

    return () => {
      cancelled = true
      if (debounce) clearTimeout(debounce)
      if (doc) {
        doc.off('update', onUpdate)
        releaseProjectDoc(projectId)
      }
    }
  }, [projectId])

  return { ready }
}
