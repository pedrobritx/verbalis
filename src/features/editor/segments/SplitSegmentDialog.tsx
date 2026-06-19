import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { splitSourceText } from '@/core/segments/operations'
import { useSegmentOpsStore } from './useSegmentOpsStore'

interface SplitSegmentDialogProps {
  projectId: string
}

export function SplitSegmentDialog({ projectId }: SplitSegmentDialogProps) {
  const splitId = useSegmentOpsStore((s) => s.splitId)
  const close = useSegmentOpsStore((s) => s.close)
  const segment = useLiveQuery(
    () => (splitId ? segmentRepo.getById(splitId) : undefined),
    [splitId],
  )
  const [offset, setOffset] = useState(0)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // Default the cut to the middle whenever a new segment opens.
  useEffect(() => {
    if (segment) setOffset(Math.floor(segment.source.length / 2))
  }, [segment?.id, segment?.source])

  const source = segment?.source ?? ''
  const parts = splitSourceText(source, offset)

  const syncCaret = () => {
    const el = taRef.current
    if (el && el.selectionStart != null) setOffset(el.selectionStart)
  }

  const handleSplit = async () => {
    if (!splitId || !parts) return
    await segmentRepo.splitSegment(projectId, splitId, offset)
    close()
  }

  return (
    <Dialog open={splitId !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Split segment</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-muted)' }}>
            Click in the source where it should be divided, then split. The first part
            keeps its translation; the second becomes a new untranslated segment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <textarea
            ref={taRef}
            readOnly
            value={source}
            onSelect={syncCaret}
            onClick={syncCaret}
            onKeyUp={syncCaret}
            rows={Math.max(2, Math.min(8, source.split('\n').length + 1))}
            aria-label="Source text — place cursor at the split point"
            data-testid="split-source"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div
              className="rounded-md border p-2 min-h-[3rem]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              data-testid="split-preview-left"
            >
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-muted)' }}
              >
                Part 1
              </div>
              {parts?.left ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}
            </div>
            <div
              className="rounded-md border p-2 min-h-[3rem]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              data-testid="split-preview-right"
            >
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-muted)' }}
              >
                Part 2
              </div>
              {parts?.right ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="bordered" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="filled"
            size="sm"
            onClick={() => void handleSplit()}
            disabled={!parts}
            data-testid="split-confirm"
          >
            Split here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
