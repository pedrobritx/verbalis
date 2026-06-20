import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { versionRepo, type SegmentHistoryEntry } from '@/storage/repositories/versionRepo'
import { diffWords } from '@/core/history/diff'
import { useSegmentHistoryStore } from './useSegmentHistoryStore'
import { relativeTime } from './relativeTime'

/** Render a word diff of `next` against `prev` with insert/delete coloring. */
function DiffText({ prev, next }: { prev: string; next: string }) {
  const parts = diffWords(prev, next)
  return (
    <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
      {parts.map((part, i) => {
        if (part.op === 'equal') return <span key={i}>{part.text}</span>
        if (part.op === 'add') {
          return (
            <span key={i} style={{ color: 'var(--color-confirm)', fontWeight: 600 }}>
              {part.text}
            </span>
          )
        }
        return (
          <span
            key={i}
            style={{ color: 'var(--color-error)', textDecoration: 'line-through' }}
          >
            {part.text}
          </span>
        )
      })}
    </p>
  )
}

/**
 * Per-segment "row history" (Foundation F2): a timeline of a segment's target
 * across project versions, with word diffs and per-version restore. Derived from
 * the stored snapshots, so no extra per-segment storage is kept.
 */
export function SegmentHistoryDialog() {
  const projectId = useSegmentHistoryStore((s) => s.projectId)
  const segmentId = useSegmentHistoryStore((s) => s.segmentId)
  const close = useSegmentHistoryStore((s) => s.close)
  const [entries, setEntries] = useState<SegmentHistoryEntry[] | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const open = projectId !== null && segmentId !== null

  useEffect(() => {
    if (!open || !projectId || !segmentId) return
    let active = true
    setEntries(null)
    void versionRepo.segmentTimeline(projectId, segmentId).then((t) => {
      if (active) setEntries(t)
    })
    return () => {
      active = false
    }
  }, [open, projectId, segmentId])

  async function handleRestore(versionId: string) {
    if (!projectId || !segmentId) return
    setRestoringId(versionId)
    try {
      await versionRepo.restoreSegment(projectId, segmentId, versionId)
      close()
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Row history</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-muted)' }}>
            How this segment's translation changed across saved versions, newest first.
          </DialogDescription>
        </DialogHeader>

        {!entries ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>
            Loading…
          </p>
        ) : entries.length === 0 ? (
          <p
            className="text-sm py-6 text-center"
            style={{ color: 'var(--color-muted)' }}
            data-testid="segment-history-empty"
          >
            No saved versions include this segment yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto" data-testid="segment-history-list">
            {entries.map((entry, i) => {
              // Diff against the next-older entry (or empty for the oldest).
              const prev = entries[i + 1]?.target ?? ''
              return (
                <li
                  key={entry.versionId}
                  className="flex flex-col gap-1.5 rounded-md border px-2.5 py-2"
                  style={{ borderColor: 'var(--color-border)' }}
                  data-testid="segment-history-item"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] uppercase tracking-wider tabular-nums"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {entry.versionLabel || (entry.kind === 'auto' ? 'Auto-saved' : 'Version')} ·{' '}
                      {entry.status} · {relativeTime(entry.createdAt)}
                      {entry.author ? ` · ${entry.author}` : ''}
                    </span>
                    <Button
                      variant="plain"
                      size="sm"
                      disabled={restoringId === entry.versionId}
                      onClick={() => void handleRestore(entry.versionId)}
                      data-testid="segment-history-restore"
                    >
                      Restore
                    </Button>
                  </div>
                  {entry.target ? (
                    <DiffText prev={prev} next={entry.target} />
                  ) : (
                    <p className="text-sm italic" style={{ color: 'var(--color-muted)' }}>
                      (empty)
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
