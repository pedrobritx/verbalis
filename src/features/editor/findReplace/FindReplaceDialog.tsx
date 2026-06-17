import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { previewReplace, type FindReplaceOptions } from '@/core/segments/findReplace'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { db } from '@/storage/db'
import { useProjectSegments } from '../useProjectSegments'
import { useFindReplaceStore } from './useFindReplaceStore'

interface FindReplaceDialogProps {
  projectId: string
}

export function FindReplaceDialog({ projectId }: FindReplaceDialogProps) {
  const open = useFindReplaceStore((s) => s.open)
  const setOpen = useFindReplaceStore((s) => s.setOpen)
  const segments = useProjectSegments(projectId)

  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  const opts: FindReplaceOptions = useMemo(
    () => ({ find, caseSensitive, wholeWord, regex }),
    [find, caseSensitive, wholeWord, regex],
  )

  const preview = useMemo(() => {
    if (!segments || !find) return []
    return previewReplace(segments, opts, replace)
  }, [segments, opts, replace, find])

  const totalHits = preview.reduce((n, r) => n + r.count, 0)

  const applyAll = async () => {
    if (preview.length === 0) return
    await db.transaction('rw', db.segments, async () => {
      for (const row of preview) {
        const seg = segments?.find((s) => s.id === row.segmentId)
        const status =
          seg && seg.status === 'untranslated' && row.after.trim() ? 'draft' : undefined
        await segmentRepo.update(row.segmentId, status ? { target: row.after, status } : { target: row.after })
      }
    })
    setDone(preview.length)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setDone(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="find-replace-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Find &amp; replace</DialogTitle>
          <DialogDescription>
            Replaces text across every target in this project. Locked segments are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Find…"
            value={find}
            onChange={(e) => {
              setFind(e.target.value)
              setDone(null)
            }}
            data-testid="fr-find"
            autoFocus
          />
          <Input
            placeholder="Replace with…"
            value={replace}
            onChange={(e) => {
              setReplace(e.target.value)
              setDone(null)
            }}
            data-testid="fr-replace"
          />
          <div className="flex flex-wrap gap-3 text-footnote" style={{ color: 'var(--color-muted)' }}>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                data-testid="fr-case"
              />
              Match case
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                data-testid="fr-word"
              />
              Whole word
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={regex}
                onChange={(e) => setRegex(e.target.checked)}
                data-testid="fr-regex"
              />
              Regex
            </label>
          </div>

          <div className="text-footnote" style={{ color: 'var(--color-muted)' }} data-testid="fr-count">
            {done !== null
              ? `Replaced in ${done} segment${done === 1 ? '' : 's'}.`
              : find
                ? `${totalHits} match${totalHits === 1 ? '' : 'es'} in ${preview.length} segment${preview.length === 1 ? '' : 's'}.`
                : 'Enter text to find.'}
          </div>

          {preview.length > 0 && done === null && (
            <ul
              className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border p-2 text-xs"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {preview.slice(0, 30).map((row) => (
                <li key={row.segmentId} className="flex flex-col gap-0.5">
                  <span className="tabular-nums" style={{ color: 'var(--color-muted)' }}>
                    #{row.index + 1}
                  </span>
                  <span className="line-through" style={{ color: 'var(--color-muted)' }}>
                    {row.before}
                  </span>
                  <span style={{ color: 'var(--color-text)' }}>{row.after}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="bordered" size="sm" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={applyAll}
              disabled={preview.length === 0 || done !== null}
              data-testid="fr-apply"
            >
              Replace all
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
