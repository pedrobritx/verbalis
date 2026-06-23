import { useState } from 'react'
import { Database, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { corpusRepo } from '@/storage/repositories/corpusRepo'
import { corpusTermsToGlossaryEntries } from '@/core/corpus/customPack'
import { exportCSV } from '@/core/glossary/csv'
import { exportTBX } from '@/core/glossary/tbx'
import { exportTSV } from '@/core/glossary/tsv'
import type { InstalledCorpusPack } from '@/core/corpus/types'

type ExportFormat = 'csv' | 'tbx' | 'tsv'

function download(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CustomCorpusCard({ pack }: { pack: InstalledCorpusPack }) {
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(format: ExportFormat) {
    setMenuOpen(false)
    setError(null)
    try {
      const terms = await corpusRepo.termsByCorpus(pack.id)
      const entries = corpusTermsToGlossaryEntries(terms)
      const slug = pack.id.replace(/^custom:/, '') || 'corpus'
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `verbalis-corpus-${slug}-${date}.${format}`
      if (format === 'csv') download(exportCSV(entries, pack.sourceLang), 'text/csv', filename)
      else if (format === 'tbx')
        download(exportTBX(entries, pack.sourceLang), 'application/xml', filename)
      else download(exportTSV(entries, pack.targetLang), 'text/tab-separated-values', filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    try {
      await corpusRepo.uninstall(pack.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ borderColor: 'var(--color-accent)', background: 'var(--color-surface)' }}
      data-testid={`custom-corpus-${pack.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body font-semibold truncate" style={{ color: 'var(--color-text)' }}>
          {pack.label}
        </h3>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-mono"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          {pack.sourceLang} → {pack.targetLang}
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        <span className="inline-flex items-center gap-1">
          <Database size={12} />
          {pack.count.toLocaleString()} terms
        </span>
        {pack.tmSeeded && <span style={{ color: 'var(--color-accent)' }}>TM seeded</span>}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="relative">
          <Button
            variant="bordered"
            size="sm"
            onClick={() => setMenuOpen((o) => !o)}
            data-testid={`custom-corpus-export-${pack.id}`}
          >
            <Upload />
            Export
          </Button>
          {menuOpen && (
            <div
              className="absolute left-0 mt-1 flex flex-col rounded-md border shadow-lg z-10"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                minWidth: '8rem',
              }}
            >
              <button
                onClick={() => void handleExport('csv')}
                className="px-3 py-2 text-sm text-left hover:opacity-80"
                style={{ color: 'var(--color-text)' }}
              >
                CSV
              </button>
              <button
                onClick={() => void handleExport('tbx')}
                className="px-3 py-2 text-sm text-left hover:opacity-80 border-t"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                TBX
              </button>
              <button
                onClick={() => void handleExport('tsv')}
                className="px-3 py-2 text-sm text-left hover:opacity-80 border-t"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              >
                OmegaT TSV
              </button>
            </div>
          )}
        </div>
        <Button
          variant="bordered"
          size="sm"
          onClick={handleRemove}
          disabled={busy}
          data-testid={`custom-corpus-remove-${pack.id}`}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Remove
        </Button>
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
