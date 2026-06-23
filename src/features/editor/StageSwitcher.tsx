import { CheckCheck, FileSearch, Languages, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorModeStore, type EditorStage } from './useEditorModeStore'

const STAGES: Array<{ id: EditorStage; label: string; Icon: LucideIcon; hint: string }> = [
  {
    id: 'prepare',
    label: 'Prepare',
    Icon: FileSearch,
    hint: 'Source preparation — leverage memory, populate numbers, analyse volume',
  },
  {
    id: 'translate',
    label: 'Translate',
    Icon: Languages,
    hint: 'Draft translations with TM, glossary and machine translation',
  },
  {
    id: 'revise',
    label: 'Revise',
    Icon: CheckCheck,
    hint: 'Review & QA — checks, spelling, tracked changes and history',
  },
]

/**
 * The primary workflow control: a Prepare · Translate · Revise segmented control.
 * Selecting a stage scopes both the action toolbar and the sidebar tabs to that
 * phase, so each stage only surfaces its relevant functionality.
 */
export function StageSwitcher() {
  const stage = useEditorModeStore((s) => s.stage)
  const setStage = useEditorModeStore((s) => s.setStage)

  return (
    <div
      role="tablist"
      aria-label="Workflow stage"
      data-testid="stage-switcher"
      className="inline-flex items-center gap-1 self-start rounded-full border p-1"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {STAGES.map(({ id, label, Icon, hint }) => {
        const isActive = stage === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={hint}
            data-testid={`stage-${id}`}
            onClick={() => setStage(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-footnote transition-colors',
              isActive ? 'font-semibold' : 'hover:bg-[var(--color-fill)]',
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
