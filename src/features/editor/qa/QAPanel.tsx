import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { runQA } from '@/core/qa/checks'
import { QA_RULE_LABELS, type QAIssue } from '@/core/qa/types'
import { useProjectSegments } from '../useProjectSegments'
import { useGlossaryCache } from '../glossary/useGlossaryCache'
import { useEditorSettings } from '../useEditorSettings'
import { useEditorActionsStore } from '../useEditorActionsStore'

interface QAPanelProps {
  projectId: string
  targetLang: string
}

function IssueRow({ issue, onJump }: { issue: QAIssue; onJump: () => void }) {
  const isError = issue.severity === 'error'
  const color = isError ? 'var(--color-error)' : 'var(--color-accent)'
  return (
    <button
      onClick={onJump}
      data-testid={`qa-issue-${issue.index}`}
      className="flex w-full flex-col gap-1 rounded-md border p-2.5 text-left text-xs transition-colors hover:bg-[var(--color-fill)]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5">
        {isError ? (
          <AlertCircle size={14} style={{ color }} />
        ) : (
          <AlertTriangle size={14} style={{ color }} />
        )}
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {QA_RULE_LABELS[issue.code]}
        </span>
        <span className="ml-auto tabular-nums" style={{ color: 'var(--color-muted)' }}>
          #{issue.index + 1}
        </span>
      </div>
      <span style={{ color: 'var(--color-muted)' }}>{issue.message}</span>
    </button>
  )
}

export function QAPanel({ projectId, targetLang }: QAPanelProps) {
  const segments = useProjectSegments(projectId)
  const glossary = useGlossaryCache(projectId)
  const settings = useEditorSettings()
  const actions = useEditorActionsStore((s) => s.actions)

  const issues = useMemo(() => {
    if (!segments) return []
    return runQA(segments, glossary ?? [], { targetLang, rules: settings.qaRules })
  }, [segments, glossary, targetLang, settings.qaRules])

  if (!segments) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </p>
    )
  }

  if (issues.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border p-3 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="qa-clean"
      >
        <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
        No issues found.
      </div>
    )
  }

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors

  return (
    <div className="flex flex-col gap-2" data-testid="qa-panel-results">
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}
      </div>
      {issues.map((issue, i) => (
        <IssueRow
          key={`${issue.segmentId}-${issue.code}-${i}`}
          issue={issue}
          onJump={() => actions?.jumpToSegment(issue.index + 1)}
        />
      ))}
    </div>
  )
}
