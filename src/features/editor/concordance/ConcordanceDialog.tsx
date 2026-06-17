import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { concordance, type ConcordanceMatch } from '@/core/tm/concordance'
import { tmRepo } from '@/storage/repositories/tmRepo'
import type { Project } from '@/core/types'
import { useConcordanceStore } from './useConcordanceStore'

interface ConcordanceDialogProps {
  project: Project
}

function Highlight({ text, start, end }: { text: string; start: number; end: number }) {
  return (
    <>
      {text.slice(0, start)}
      <mark style={{ background: 'var(--color-accent-fill)', color: 'var(--color-accent)' }}>
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  )
}

export function ConcordanceDialog({ project }: ConcordanceDialogProps) {
  const open = useConcordanceStore((s) => s.open)
  const setOpen = useConcordanceStore((s) => s.setOpen)
  const initialQuery = useConcordanceStore((s) => s.initialQuery)
  const [query, setQuery] = useState('')

  const entries = useLiveQuery(
    () => tmRepo.byLangPair(project.sourceLang, project.targetLang),
    [project.sourceLang, project.targetLang],
  )

  useEffect(() => {
    if (open) setQuery(initialQuery)
  }, [open, initialQuery])

  const matches = useMemo<ConcordanceMatch[]>(() => {
    if (!entries || !query.trim()) return []
    return concordance(query, entries, { field: 'both', limit: 50 })
  }, [entries, query])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="concordance-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Concordance</DialogTitle>
          <DialogDescription>
            Search the TM ({project.sourceLang} → {project.targetLang}) for how a phrase was
            translated before.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search the translation memory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="concordance-input"
          autoFocus
        />

        <div
          className="text-footnote"
          style={{ color: 'var(--color-muted)' }}
          data-testid="concordance-count"
        >
          {query.trim() ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'Enter a phrase.'}
        </div>

        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {matches.map((m, i) => (
            <li
              key={`${m.entry.id}-${m.field}-${i}`}
              className="flex flex-col gap-1 rounded-md border p-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)' }}
              data-testid={`concordance-hit-${i}`}
            >
              <span className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--color-muted)' }}>
                {m.field === 'source' ? (
                  <Highlight text={m.entry.source} start={m.start} end={m.end} />
                ) : (
                  m.entry.source
                )}
              </span>
              <span className="whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
                {m.field === 'target' ? (
                  <Highlight text={m.entry.target} start={m.start} end={m.end} />
                ) : (
                  m.entry.target
                )}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
