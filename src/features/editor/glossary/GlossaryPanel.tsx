import { useEffect } from 'react'
import type { GlossaryHit } from '@/core/glossary/match'
import { useGlossaryMatches } from './useGlossaryMatches'

interface GlossaryPanelProps {
  focusedSource: string | undefined
  projectId: string | undefined
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

export function GlossaryPanel({
  focusedSource,
  projectId,
  targetLang,
  onInsert,
}: GlossaryPanelProps) {
  const hits = useGlossaryMatches(focusedSource, projectId)

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

  if (hits.length === 0) {
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
    </div>
  )
}
