import { Sparkles, Hash, Replace, ShieldCheck, BarChart3 } from 'lucide-react'

interface EditorToolbarProps {
  onPretranslate: () => void
  onPopulateNumbers: () => void
  onFindReplace: () => void
  onRunQA: () => void
  onAnalysis: () => void
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-footnote transition-colors hover:bg-[var(--color-fill)]'

export function EditorToolbar({
  onPretranslate,
  onPopulateNumbers,
  onFindReplace,
  onRunQA,
  onAnalysis,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="editor-toolbar">
      <button
        onClick={onPretranslate}
        className={BTN}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="tool-pretranslate"
      >
        <Sparkles size={14} />
        Pre-translate
      </button>
      <button
        onClick={onPopulateNumbers}
        className={BTN}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="tool-numbers"
      >
        <Hash size={14} />
        Numbers
      </button>
      <button
        onClick={onFindReplace}
        className={BTN}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="tool-find-replace"
      >
        <Replace size={14} />
        Find &amp; replace
      </button>
      <button
        onClick={onRunQA}
        className={BTN}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="tool-qa"
      >
        <ShieldCheck size={14} />
        QA
      </button>
      <button
        onClick={onAnalysis}
        className={BTN}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="tool-analysis"
      >
        <BarChart3 size={14} />
        Analysis
      </button>
    </div>
  )
}
