import { useEffect } from 'react'
import type { TMMatch } from '@/core/types'
import { useTMMatches } from './useTMMatches'

interface TMPanelProps {
  focusedSource: string | undefined
  sourceLang: string
  targetLang: string
  onApply: (target: string) => void
}

function qualityColor(score: number): string {
  if (score >= 0.95) return '#22c55e' // green
  if (score >= 0.8) return 'var(--color-accent)'
  return 'var(--color-muted)'
}

function MatchCard({
  match,
  index,
  onApply,
}: {
  match: TMMatch
  index: number
  onApply: (target: string) => void
}) {
  const pct = Math.floor(match.score * 100)
  return (
    <div
      data-testid={`tm-match-${index}`}
      data-tm-score={pct}
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            border: `1px solid ${qualityColor(match.score)}`,
            color: qualityColor(match.score),
          }}
        >
          {pct}%{match.isExact ? ' · exact' : ''}
        </span>
        <button
          onClick={() => onApply(match.entry.target)}
          className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
          }}
          data-testid={`tm-apply-${index}`}
        >
          Apply <kbd className="opacity-70">⌃{index + 1}</kbd>
        </button>
      </div>
      <div
        className="text-xs whitespace-pre-wrap break-words"
        style={{ color: 'var(--color-muted)' }}
      >
        {match.entry.source}
      </div>
      <div
        className="whitespace-pre-wrap break-words"
        style={{ color: 'var(--color-text)' }}
      >
        {match.entry.target}
      </div>
    </div>
  )
}

export function TMPanel({ focusedSource, sourceLang, targetLang, onApply }: TMPanelProps) {
  const matches = useTMMatches(focusedSource, sourceLang, targetLang)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return
      const n = parseInt(e.key, 10)
      if (!Number.isFinite(n) || n < 1 || n > matches.length) return
      const target = matches[n - 1]?.entry.target
      if (target === undefined) return
      e.preventDefault()
      onApply(target)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [matches, onApply])

  if (!focusedSource?.trim()) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Focus a segment to see matches.
      </p>
    )
  }

  if (matches.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        No matches above 70%.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {matches.map((m, i) => (
        <MatchCard key={m.entry.id} match={m} index={i} onApply={onApply} />
      ))}
    </div>
  )
}
