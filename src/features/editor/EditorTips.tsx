import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'

const STORAGE_KEY = 'verbalis.tips.editor.dismissed'

interface Tip {
  label: string
  body: string
}

const TIPS: Tip[] = [
  {
    label: 'Confirm',
    body: 'Press Ctrl/⌘+Enter (or the ✓ button) to confirm a segment and jump to the next.',
  },
  {
    label: 'Review',
    body: 'Ctrl/⌘+Shift+Enter marks a segment reviewed; Ctrl/⌘+Shift+R toggles review mode.',
  },
  {
    label: 'Comments',
    body: 'Use the 💬 button on a row to leave a note for yourself or a reviewer.',
  },
  {
    label: 'Edit source',
    body: 'The “Source” pencil under the source text lets you fix a mis-segmented original.',
  },
  { label: 'Segments', body: 'The ⋯ menu on a row splits, joins (Ctrl/⌘+J), or locks a segment.' },
  {
    label: 'Formatting',
    body: 'Enable “Rich text editing” in Settings for bold/italic/sub-sup and case changes.',
  },
  {
    label: 'Everything',
    body: 'Press Ctrl/⌘+K to open the command palette and search every action.',
  },
]

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A dismissible strip of guiding tips for the editor. Stays out of the way once
 * dismissed (persisted in localStorage) and can be summoned again from the small
 * lightbulb affordance.
 */
export function EditorTips() {
  const [dismissed, setDismissed] = useState(readDismissed)

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage unavailable (private mode) — dismissal is session-only.
    }
  }

  function reopen() {
    setDismissed(false)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={reopen}
        aria-label="Show tips"
        title="Show tips"
        data-testid="editor-tips-reopen"
        className="inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-footnote transition-colors hover:bg-[var(--color-fill)]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        <Lightbulb size={14} />
        Tips
      </button>
    )
  }

  return (
    <div
      className="flex items-start gap-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-accent-fill)',
      }}
      data-testid="editor-tips"
      role="note"
    >
      <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
      <ul
        className="flex flex-col gap-1 flex-1 text-footnote"
        style={{ color: 'var(--color-text)' }}
      >
        {TIPS.map((t) => (
          <li key={t.label}>
            <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
              {t.label}:
            </span>{' '}
            {t.body}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tips"
        title="Dismiss tips"
        data-testid="editor-tips-dismiss"
        className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--color-fill)]"
        style={{ color: 'var(--color-muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
