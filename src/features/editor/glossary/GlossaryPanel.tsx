import { useEffect } from 'react'
import type { GlossaryHit } from '@/core/glossary/match'
import type { CorpusHit } from '@/core/corpus/match'
import { useGlossaryMatches } from './useGlossaryMatches'
import { useCorpusMatches } from '../corpus/useCorpusMatches'

interface GlossaryPanelProps {
  focusedSource: string | undefined
  projectId: string | undefined
  sourceLang?: string
  targetLang: string
  onInsert: (text: string) => void
}

function pickTranslation(
  translations: Record<string, string>,
  targetLang: string,
): { lang: string; value: string } | null {
  if (translations[targetLang]) return { lang: targetLang, value: translations[targetLang] }
  const base = targetLang.split('-')[0]
  for (const [lang, value] of Object.entries(translations)) {
    if (lang.split('-')[0] === base) return { lang, value }
  }
  const first = Object.entries(translations)[0]
  return first ? { lang: first[0], value: first[1] } : null
}

function HitCard({
  hit,
  index,
  targetLang,
  onInsert,
}: {
  hit: GlossaryHit
  index: number
  targetLang: string
  onInsert: (text: string) => void
}) {
  const picked = pickTranslation(hit.entry.translations, targetLang)
  const definition = hit.entry.definition?.trim()
  return (
    <div
      data-testid={`glossary-hit-${index}`}
      data-glossary-term={hit.entry.term}
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {hit.entry.term}
          </span>
          {picked && (
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-xs"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
              }}
            >
              {picked.lang}
            </span>
          )}
        </div>
        {picked && index < 5 && (
          <button
            onClick={() => onInsert(picked.value)}
            className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
            }}
            data-testid={`glossary-insert-${index}`}
          >
            Insert <kbd className="opacity-70">⌃⇧{index + 1}</kbd>
          </button>
        )}
        {picked && index >= 5 && (
          <button
            onClick={() => onInsert(picked.value)}
            className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
            }}
            data-testid={`glossary-insert-${index}`}
          >
            Insert
          </button>
        )}
      </div>
      {picked && (
        <div className="text-sm break-words" style={{ color: 'var(--color-text)' }}>
          {picked.value}
        </div>
      )}
      {definition && (
        <div
          className="text-xs break-words"
          style={{ color: 'var(--color-muted)' }}
        >
          {definition}
        </div>
      )}
      {hit.entry.notes && (
        <div
          className="text-xs italic break-words"
          style={{ color: 'var(--color-muted)' }}
        >
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

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      const n = parseInt(e.key, 10)
      if (!Number.isFinite(n) || n < 1 || n > Math.min(5, hits.length)) return
      const hit = hits[n - 1]
      if (!hit) return
      const picked = pickTranslation(hit.entry.translations, targetLang)
      if (!picked) return
      e.preventDefault()
      onInsert(picked.value)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hits, onInsert, targetLang])

  if (!focusedSource?.trim()) {
    return (
      <p
        className="text-xs"
        style={{ color: 'var(--color-muted)' }}
        data-testid="glossary-empty"
      >
        Focus a segment to see glossary hits.
      </p>
    )
  }

  if (hits.length === 0 && corpusHits.length === 0) {
    return (
      <p
        className="text-xs"
        style={{ color: 'var(--color-muted)' }}
        data-testid="glossary-empty"
      >
        No glossary terms in this segment.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="glossary-hits">
      {hits.map((hit, i) => (
        <HitCard
          key={hit.entry.id}
          hit={hit}
          index={i}
          targetLang={targetLang}
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
