import { useCallback, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { shareRepo } from '@/storage/repositories/shareRepo'
import { startProjectSync, stopProjectSync } from '@/storage/sync/syncManager'
import type { SyncSessionHandle } from '@/storage/sync/syncSession'
import type { CaretRange } from '@/storage/sync/presence'
import { usePresenceStore } from './usePresenceStore'

/**
 * Drives the live collaboration session for the open project (Foundation F3).
 *
 * Mounted once at the editor level. It reads the per-project share flag, starts
 * a sync session while sharing is on (and tears it down otherwise), and
 * publishes the peer roster into {@link usePresenceStore} for the Peers panel.
 * It also exposes `setActiveSegment` so presence can follow the user's focus.
 */
export function useProjectSync(projectId: string | undefined): {
  setActiveSegment: (id: string | undefined, caret?: CaretRange) => void
} {
  const share = useLiveQuery(
    () => (projectId ? shareRepo.get(projectId) : undefined),
    [projectId],
  )
  const shared = share?.shared ?? false

  const setShared = usePresenceStore((s) => s.setShared)
  const setPeers = usePresenceStore((s) => s.setPeers)
  const setSelfPeerId = usePresenceStore((s) => s.setSelfPeerId)
  const reset = usePresenceStore((s) => s.reset)
  const handleRef = useRef<SyncSessionHandle | null>(null)

  // Keep the panel's toggle in sync with the persisted flag.
  useEffect(() => {
    setShared(shared)
  }, [shared, setShared])

  useEffect(() => {
    if (!projectId || !shared) return
    let cancelled = false
    let unsub: (() => void) | undefined

    void startProjectSync(projectId).then((handle) => {
      if (cancelled) {
        stopProjectSync(projectId)
        return
      }
      handleRef.current = handle
      setSelfPeerId(handle.peerId)
      unsub = handle.subscribe(setPeers)
    })

    return () => {
      cancelled = true
      unsub?.()
      handleRef.current = null
      setPeers([])
      setSelfPeerId(undefined)
      stopProjectSync(projectId)
    }
  }, [projectId, shared, setPeers, setSelfPeerId])

  useEffect(() => () => reset(), [reset])

  const setActiveSegment = useCallback((id: string | undefined, caret?: CaretRange) => {
    handleRef.current?.setActiveSegment(id, caret)
  }, [])

  return { setActiveSegment }
}
