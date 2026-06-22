import { diffWords } from '@/core/history/diff'

/**
 * Render a word diff of `next` against `prev`: additions coloured (per-author in
 * the Changes view, the confirm colour in Row history), deletions struck through.
 * Shared by the Row-history dialog and the project-wide Changes panel.
 */
export function DiffText({
  prev,
  next,
  addColor = 'var(--color-confirm)',
}: {
  prev: string
  next: string
  addColor?: string
}) {
  const parts = diffWords(prev, next)
  return (
    <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
      {parts.map((part, i) => {
        if (part.op === 'equal') return <span key={i}>{part.text}</span>
        if (part.op === 'add') {
          return (
            <span key={i} style={{ color: addColor, fontWeight: 600 }}>
              {part.text}
            </span>
          )
        }
        return (
          <span key={i} style={{ color: 'var(--color-error)', textDecoration: 'line-through' }}>
            {part.text}
          </span>
        )
      })}
    </p>
  )
}
