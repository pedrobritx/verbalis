import { Sparkles, Hash, Replace, ShieldCheck, BarChart3, type LucideIcon } from 'lucide-react'
import type { EditorStage } from '../useEditorModeStore'

interface EditorToolbarProps {
  stage: EditorStage
  onPretranslate: () => void
  onPopulateNumbers: () => void
  onFindReplace: () => void
  onRunQA: () => void
  onAnalysis: () => void
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-footnote transition-colors hover:bg-[var(--color-fill)]'

/**
 * The action toolbar, scoped to the active workflow stage so each phase only
 * offers its relevant batch tools. Pre-translate and Find & replace deliberately
 * span more than one stage; the rest are phase-specific.
 */
export function EditorToolbar({
  stage,
  onPretranslate,
  onPopulateNumbers,
  onFindReplace,
  onRunQA,
  onAnalysis,
}: EditorToolbarProps) {
  const tools: Array<{
    id: string
    label: string
    Icon: LucideIcon
    onClick: () => void
    stages: EditorStage[]
    testid: string
  }> = [
    {
      id: 'pretranslate',
      label: 'Pre-translate',
      Icon: Sparkles,
      onClick: onPretranslate,
      stages: ['prepare', 'translate'],
      testid: 'tool-pretranslate',
    },
    {
      id: 'numbers',
      label: 'Numbers',
      Icon: Hash,
      onClick: onPopulateNumbers,
      stages: ['prepare'],
      testid: 'tool-numbers',
    },
    {
      id: 'analysis',
      label: 'Analysis',
      Icon: BarChart3,
      onClick: onAnalysis,
      stages: ['prepare'],
      testid: 'tool-analysis',
    },
    {
      id: 'qa',
      label: 'QA',
      Icon: ShieldCheck,
      onClick: onRunQA,
      stages: ['revise'],
      testid: 'tool-qa',
    },
    {
      id: 'find-replace',
      label: 'Find & replace',
      Icon: Replace,
      onClick: onFindReplace,
      stages: ['translate', 'revise'],
      testid: 'tool-find-replace',
    },
  ]

  const visible = tools.filter((t) => t.stages.includes(stage))

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="editor-toolbar">
      {visible.map(({ id, label, Icon, onClick, testid }) => (
        <button
          key={id}
          onClick={onClick}
          className={BTN}
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          data-testid={testid}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}
