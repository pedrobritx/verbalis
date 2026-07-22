import { PenLine, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorModeStore, type EditMode } from './useEditorModeStore'

const MODES: Array<{ id: EditMode; label: string; icon: typeof PenLine; hint: string }> = [
  {
    id: 'direct',
    label: 'Editing',
    icon: PenLine,
    hint: 'Edits change the target text directly',
  },
  {
    id: 'suggesting',
    label: 'Suggesting',
    icon: MessageSquarePlus,
    hint: 'Edits become tracked suggestions you or a reviewer can accept or reject',
  },
]

/**
 * Global toggle between direct editing and suggesting mode (Google-Docs style).
 * In suggesting mode, typing and deleting in the rich editor become tracked
 * changes attributed to the local author.
 */
export function EditModeToggle({ forced = false }: { forced?: boolean }) {
  const editMode = useEditorModeStore((s) => s.editMode)
  const setEditMode = useEditorModeStore((s) => s.setEditMode)

  return (
    <div
      role="radiogroup"
      aria-label="Edit mode"
      data-testid="edit-mode-toggle"
      data-forced={forced ? 'true' : undefined}
      title={forced ? 'Your role must suggest changes at this workflow stage' : undefined}
      className="inline-flex items-center gap-1 self-start rounded-full border p-1"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        opacity: forced ? 0.7 : 1,
      }}
    >
      {MODES.map(({ id, label, icon: Icon, hint }) => {
        const isActive = editMode === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            // When the workflow forces suggesting, the toggle is locked to it.
            disabled={forced}
            title={forced ? 'Your role must suggest changes at this workflow stage' : hint}
            data-testid={`edit-mode-${id}`}
            onClick={() => setEditMode(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-footnote transition-colors',
              isActive ? 'font-semibold' : 'hover:bg-[var(--color-fill)]',
              forced && 'cursor-not-allowed',
            )}
            style={{
              background: isActive ? 'var(--color-accent-fill)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
