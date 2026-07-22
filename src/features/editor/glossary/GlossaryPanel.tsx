import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { GlossaryHit } from '@/core/glossary/match'
import type { CorpusHit } from '@/core/corpus/match'
import { rankTranslations, type TranslationCandidate } from '@/core/glossary/rank'
import { llmRankCandidates } from '@/core/glossary/llmRank'
import { resolveDefaultProvider } from '@/core/mt'
import { getMTSettings } from '@/storage/repositories/settingsRepo'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import type { MTProviderId, MTSettings } from '@/core/types'
import { useGlossaryMatches } from './useGlossaryMatches'
import { useGlossaryEditStore } from './useGlossaryEditStore'
import { useAddTermStore } from './useAddTermStore'
import { useCorpusMatches } from '../corpus/useCorpusMatches'
import { useEditorSelectionStore } from '../useEditorSelectionStore'

interface GlossaryPanelProps {
  focusedSource: string | undefined
  projectId: string | undefined
  sourceLang?: string
  targetLang: string
  onInsert: (text: string) => void
}

function CandidateRow({
  candidate,
  primary,
  shortcut,
  onInsert,
}: {
  candidate: TranslationCandidate
  primary: boolean
  shortcut?: string
  onInsert: (text: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span
          className={primary ? 'text-sm font-medium break-words' : 'text-sm break-words'}
          style={{ color: 'var(--color-text)' }}
        >
          {candidate.value}
        </span>
        <span className="flex flex-wrap gap-1 mt-0.5">
          {candidate.reasons.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded px-1 py-0.5 text-[10px]"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            >
              {r}
            </span>
          ))}
        </span>
      </div>
      <button
        onClick={() => onInsert(candidate.value)}
        className="shrink-0 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
        style={{
          background: primary ? 'var(--color-accent)' : 'transparent',
          color: primary ? 'var(--color-bg)' : 'var(--color-accent)',
          border: primary ? 'none' : '1px solid var(--color-border)',
        }}
        data-testid={primary ? 'glossary-insert-primary' : 'glossary-insert-secondary'}
      >
        Insert{shortcut ? <kbd className="opacity-70"> {shortcut}</kbd> : null}
      </button>
    </div>
  )
}

function HitCard({
  hit,
  index,
  candidates,
  onInsert,
}: {
  hit: GlossaryHit
  index: number
  candidates: TranslationCandidate[]
  onInsert: (text: string) => void
}) {
  const openEntry = useGlossaryEditStore((s) => s.openEntry)
  const definition = hit.entry.definition?.trim()
  const [primary, ...rest] = candidates

  const onDelete = async () => {
    if (window.confirm(`Delete glossary term "${hit.entry.term}"?`)) {
      await glossaryRepo.remove(hit.entry.id)
    }
  }

  return (
    <div
      data-testid={`glossary-hit-${index}`}
      data-glossary-term={hit.entry.term}
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
          {hit.entry.term}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => openEntry(hit.entry)}
            aria-label={`Edit ${hit.entry.term}`}
            title="Edit term"
            data-testid={`glossary-edit-${index}`}
            className="p-1 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-muted)' }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${hit.entry.term}`}
            title="Delete term"
            data-testid={`glossary-delete-${index}`}
            className="p-1 rounded transition-colors hover:bg-[var(--color-fill)]"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {primary ? (
        <CandidateRow
          candidate={primary}
          primary
          shortcut={index < 5 ? `⌃⇧${index + 1}` : undefined}
          onInsert={onInsert}
        />
      ) : (
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          No translation yet.
        </span>
      )}

      {rest.length > 0 && (
        <div
          className="flex flex-col gap-1.5 pt-1 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {rest.map((c) => (
            <CandidateRow
              key={`${c.lang}:${c.value}`}
              candidate={c}
              primary={false}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}

      {definition && (
        <div className="text-xs break-words" style={{ color: 'var(--color-muted)' }}>
          {definition}
        </div>
      )}
      {hit.entry.notes && (
        <div className="text-xs italic break-words" style={{ color: 'var(--color-muted)' }}>
          {hit.entry.notes}
        </div>
      )}
    </div>
  )
}

function CorpusHitCard({
  hit,
  index,
  onInsert,
}: {
  hit: CorpusHit
  index: number
  onInsert: (text: string) => void
}) {
  return (
    <div
      data-testid={`corpus-hit-${index}`}
      data-corpus-term={hit.term.source}
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
          {hit.matchedSide === 'source' ? hit.term.source : hit.term.target}
        </span>
        <button
          onClick={() => onInsert(hit.suggestion)}
          className="shrink-0 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
          data-testid={`corpus-insert-${index}`}
        >
          Insert
        </button>
      </div>
      <div className="text-sm break-words" style={{ color: 'var(--color-text)' }}>
        {hit.suggestion}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
          style={{ background: 'var(--color-accent-fill)', color: 'var(--color-accent)' }}
        >
          {hit.term.corpusId}
        </span>
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          {hit.term.origin}
        </span>
      </div>
      {hit.term.note && (
        <div className="text-xs italic break-words" style={{ color: 'var(--color-muted)' }}>
          {hit.term.note}
        </div>
      )}
    </div>
  )
}

export function GlossaryPanel({
  focusedSource,
  projectId,
  sourceLang,
  targetLang,
  onInsert,
}: GlossaryPanelProps) {
  const hits = useGlossaryMatches(focusedSource, projectId)
  const corpusHits = useCorpusMatches(focusedSource, sourceLang)
  const openAddTerm = useAddTermStore((s) => s.openWith)
  const selection = useEditorSelectionStore((s) => s.text)

  const [mtSettings, setMtSettings] = useState<MTSettings | null>(null)
  const [aiByEntry, setAiByEntry] = useState<Record<string, TranslationCandidate[]>>({})
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    void getMTSettings().then((s) => {
      if (!cancelled) setMtSettings(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Re-ranking is bound to the focused segment; reset AI overrides when it changes.
  useEffect(() => {
    setAiByEntry({})
    setAiState('idle')
  }, [focusedSource])

  const provider: MTProviderId | undefined = mtSettings
    ? resolveDefaultProvider(mtSettings)
    : undefined

  // Local ranking for every hit (the AI pass, when run, overrides per entry).
  const localCandidates = useMemo(() => {
    const map: Record<string, TranslationCandidate[]> = {}
    for (const hit of hits) {
      map[hit.entry.id] = rankTranslations(hit.entry, { targetLang, segment: focusedSource })
    }
    return map
  }, [hits, targetLang, focusedSource])

  const candidatesFor = useCallback(
    (entryId: string): TranslationCandidate[] =>
      aiByEntry[entryId] ?? localCandidates[entryId] ?? [],
    [aiByEntry, localCandidates],
  )

  const rankWithAi = useCallback(async () => {
    if (!mtSettings || !provider || !focusedSource) return
    setAiState('loading')
    try {
      const next: Record<string, TranslationCandidate[]> = {}
      await Promise.all(
        hits.map(async (hit) => {
          const local = localCandidates[hit.entry.id] ?? []
          next[hit.entry.id] = await llmRankCandidates(local, {
            source: hit.entry.term,
            segment: focusedSource,
            sourceLang: sourceLang ?? 'auto',
            targetLang,
            providerId: provider,
            settings: mtSettings,
          })
        }),
      )
      setAiByEntry(next)
      setAiState('idle')
    } catch {
      setAiState('error')
    }
  }, [mtSettings, provider, focusedSource, hits, localCandidates, sourceLang, targetLang])

  // Ctrl/Cmd+Shift+1..5 inserts the top candidate of the matching hit.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      const n = parseInt(e.key, 10)
      if (!Number.isFinite(n) || n < 1 || n > Math.min(5, hits.length)) return
      const hit = hits[n - 1]
      if (!hit) return
      const top = candidatesFor(hit.entry.id)[0]
      if (!top) return
      e.preventDefault()
      onInsert(top.value)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hits, onInsert, candidatesFor])

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {provider && hits.length > 0 && (
          <button
            onClick={() => void rankWithAi()}
            disabled={aiState === 'loading' || !focusedSource}
            data-testid="glossary-ai-rank"
            title={`Re-rank with ${provider} using the segment context`}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:bg-[var(--color-fill)] disabled:opacity-40"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <Sparkles size={12} />
            {aiState === 'loading' ? 'Ranking…' : 'Rank with AI'}
          </button>
        )}
      </div>
      <button
        onClick={() => openAddTerm(selection || focusedSource?.split(/\s+/)[0] || '')}
        data-testid="glossary-add-term"
        title="Add a glossary term"
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:bg-[var(--color-fill)]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        <Plus size={12} />
        Add term
      </button>
    </div>
  )

  if (!focusedSource?.trim()) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="glossary-empty">
          Focus a segment to see glossary hits.
        </p>
      </div>
    )
  }

  if (hits.length === 0 && corpusHits.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="glossary-empty">
          No glossary terms in this segment.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="glossary-hits">
      {header}
      {aiState === 'error' && (
        <p
          className="text-xs"
          style={{ color: 'var(--color-error)' }}
          data-testid="glossary-ai-error"
        >
          AI ranking failed — showing local ranking.
        </p>
      )}
      {hits.map((hit, i) => (
        <HitCard
          key={hit.entry.id}
          hit={hit}
          index={i}
          candidates={candidatesFor(hit.entry.id)}
          onInsert={onInsert}
        />
      ))}
      {corpusHits.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
            data-testid="corpus-hits-heading"
          >
            <span>From corpora</span>
            <span className="flex-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
          </div>
          {corpusHits.map((hit, i) => (
            <CorpusHitCard key={hit.term.id} hit={hit} index={i} onInsert={onInsert} />
          ))}
        </>
      )}
    </div>
  )
}
