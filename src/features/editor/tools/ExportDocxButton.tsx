import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FileDown, AlertTriangle } from 'lucide-react'
import { documentRepo, blockRepo, assetRepo } from '@/storage/repositories/documentRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { exportProjectDocx, hasPendingForExport } from '@/core/documents/toDocx'

/**
 * Export the translated document as a clean .docx (Phase 2.4). Only shown for
 * projects that have a document tree (monolingual). Pending tracked changes are
 * exported as their accepted preview (D2); a warning marker appears when any
 * remain unresolved.
 */
export function ExportDocxButton({ projectId, name }: { projectId: string; name: string }) {
  const [busy, setBusy] = useState(false)
  const doc = useLiveQuery(() => documentRepo.getByProject(projectId), [projectId])
  const segments = useLiveQuery(() => segmentRepo.byProject(projectId), [projectId])
  const pending = segments ? hasPendingForExport(segments) : false

  if (!doc) return null

  const onExport = async () => {
    if (busy) return
    setBusy(true)
    try {
      const [blocks, segs, assets] = await Promise.all([
        blockRepo.byDocument(doc.id),
        segmentRepo.byProject(projectId),
        assetRepo.byDocument(doc.id),
      ])
      const blob = await exportProjectDocx(blocks, segs, assets)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.trim() || 'document'}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={busy}
      data-testid="export-docx"
      title={pending ? 'Pending suggestions will be exported as accepted' : 'Export the translated document as .docx'}
      className="inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-footnote transition-colors hover:bg-[var(--color-fill)] disabled:opacity-50"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
    >
      <FileDown size={14} />
      {busy ? 'Exporting…' : 'Export .docx'}
      {pending && (
        <AlertTriangle size={13} data-testid="export-pending-warning" style={{ color: 'var(--color-error)' }} />
      )}
    </button>
  )
}
