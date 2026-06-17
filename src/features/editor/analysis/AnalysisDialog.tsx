import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  analyzeProject,
  LEVERAGE_BUCKETS,
  LEVERAGE_LABELS,
} from '@/core/analysis/report'
import { tmRepo } from '@/storage/repositories/tmRepo'
import type { Project } from '@/core/types'
import { useProjectSegments } from '../useProjectSegments'
import { useAnalysisStore } from './useAnalysisStore'

interface AnalysisDialogProps {
  project: Project
}

export function AnalysisDialog({ project }: AnalysisDialogProps) {
  const open = useAnalysisStore((s) => s.open)
  const setOpen = useAnalysisStore((s) => s.setOpen)
  const segments = useProjectSegments(project.id)
  const tm = useLiveQuery(
    () => tmRepo.byLangPair(project.sourceLang, project.targetLang),
    [project.sourceLang, project.targetLang],
  )

  const report = useMemo(() => {
    if (!segments) return null
    return analyzeProject(segments, tm ?? [], {
      sourceLang: project.sourceLang,
      targetLang: project.targetLang,
    })
  }, [segments, tm, project.sourceLang, project.targetLang])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-lg"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="analysis-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Analysis</DialogTitle>
          <DialogDescription>
            Word counts and TM leverage for {project.sourceLang} → {project.targetLang}.
          </DialogDescription>
        </DialogHeader>

        {!report ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Segments" value={report.totalSegments} />
              <Stat label="Words" value={report.totalWords} />
              <Stat label="Characters" value={report.totalChars} />
            </div>

            <div className="flex flex-col gap-1">
              <h3
                className="text-footnote uppercase tracking-wider font-semibold"
                style={{ color: 'var(--color-muted)' }}
              >
                TM leverage
              </h3>
              <table className="w-full text-sm" data-testid="analysis-leverage">
                <thead>
                  <tr style={{ color: 'var(--color-muted)' }} className="text-left text-xs">
                    <th className="py-1 font-medium">Category</th>
                    <th className="py-1 text-right font-medium">Segments</th>
                    <th className="py-1 text-right font-medium">Words</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVERAGE_BUCKETS.map((bucket) => {
                    const stat = report.leverage[bucket]
                    return (
                      <tr key={bucket} style={{ color: 'var(--color-text)' }}>
                        <td className="py-1">{LEVERAGE_LABELS[bucket]}</td>
                        <td className="py-1 text-right tabular-nums">{stat.segments}</td>
                        <td className="py-1 text-right tabular-nums">{stat.words}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border p-2"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
    </div>
  )
}
