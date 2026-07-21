import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FileDown, AlertTriangle, HardDriveDownload, Check } from 'lucide-react'
import { documentRepo, blockRepo, assetRepo } from '@/storage/repositories/documentRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { exportProjectDocx, hasPendingForExport } from '@/core/documents/toDocx'
import type { StorageConnector } from '@/extensions/connectors/types'
import { isGdriveAvailable } from '@/extensions/connectors/gdrive/config'
import { isOnedriveAvailable } from '@/extensions/connectors/onedrive/config'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Export the translated document as a clean .docx (Phase 2.4). Only shown for
 * projects that have a document tree (monolingual). Pending tracked changes are
 * exported as their accepted preview (D2); a warning marker appears when any
 * remain unresolved. When a storage connector is available (Google Drive —
 * Phase 6.3, OneDrive — Phase 6.4), a "Save to …" action uploads the same .docx
 * back to that cloud drive.
 */
export function ExportDocxButton({ projectId, name }: { projectId: string; name: string }) {
  const [busy, setBusy] = useState(false)
  const doc = useLiveQuery(() => documentRepo.getByProject(projectId), [projectId])
  const segments = useLiveQuery(() => segmentRepo.byProject(projectId), [projectId])
  const pending = segments ? hasPendingForExport(segments) : false
  const gdrive = isGdriveAvailable()
  const onedrive = isOnedriveAvailable()

  if (!doc) return null

  const filename = `${name.trim() || 'document'}.docx`

  const buildBlob = async (): Promise<Blob> => {
    const [blocks, segs, assets] = await Promise.all([
      blockRepo.byDocument(doc.id),
      segmentRepo.byProject(projectId),
      assetRepo.byDocument(doc.id),
    ])
    return exportProjectDocx(blocks, segs, assets)
  }

  const onExport = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await buildBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
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

      {gdrive && (
        <SaveToCloudButton
          label="Drive"
          testId="export-docx-gdrive"
          filename={filename}
          buildBlob={buildBlob}
          loadConnector={async () => (await import('@/extensions/connectors/gdrive')).gdriveConnector}
        />
      )}
      {onedrive && (
        <SaveToCloudButton
          label="OneDrive"
          testId="export-docx-onedrive"
          filename={filename}
          buildBlob={buildBlob}
          loadConnector={async () => (await import('@/extensions/connectors/onedrive')).onedriveConnector}
        />
      )}
    </div>
  )
}

/** Uploads the exported .docx to a storage connector loaded on demand. */
function SaveToCloudButton({
  label,
  testId,
  filename,
  buildBlob,
  loadConnector,
}: {
  label: string
  testId: string
  filename: string
  buildBlob: () => Promise<Blob>
  loadConnector: () => Promise<StorageConnector>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const bytes = await (await buildBlob()).arrayBuffer()
      const connector = await loadConnector()
      await connector.uploadFile({ name: filename, mimeType: DOCX_MIME, bytes })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save to ${label}.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onSave()}
      disabled={saving}
      data-testid={testId}
      title={error ?? `Save the translated .docx to ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-footnote transition-colors hover:bg-[var(--color-fill)] disabled:opacity-50"
      style={{ borderColor: 'var(--color-border)', color: error ? 'var(--color-error)' : 'var(--color-muted)' }}
    >
      {saved ? <Check size={14} /> : <HardDriveDownload size={14} />}
      {saving ? 'Saving…' : saved ? `Saved to ${label}` : `Save to ${label}`}
    </button>
  )
}
