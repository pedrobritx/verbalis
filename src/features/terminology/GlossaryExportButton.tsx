import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportCSV } from '@/core/glossary/csv'
import { exportTBX } from '@/core/glossary/tbx'
import { exportTSV } from '@/core/glossary/tsv'
import type { GlossaryEntry } from '@/core/types'

type ExportFormat = 'csv' | 'tbx' | 'tsv'

interface GlossaryExportButtonProps {
  entries: GlossaryEntry[]
  sourceLang?: string
  targetLang?: string
}

function buildFilename(format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `verbalis-glossary-${date}.${format}`
}

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

export function GlossaryExportButton({
  entries,
  sourceLang,
  targetLang,
}: GlossaryExportButtonProps) {
  const [open, setOpen] = useState(false)
  const disabled = entries.length === 0
  const tsvLang = targetLang ?? Object.keys(entries[0]?.translations ?? {})[0]

  function handleExport(format: ExportFormat) {
    if (format === 'csv') {
      download(exportCSV(entries, sourceLang), 'text/csv', buildFilename('csv'))
    } else if (format === 'tbx') {
      download(exportTBX(entries, sourceLang ?? 'en'), 'application/xml', buildFilename('tbx'))
    } else if (tsvLang) {
      download(exportTSV(entries, tsvLang), 'text/tab-separated-values', buildFilename('tsv'))
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="bordered"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        data-testid="glossary-export-button"
      >
        <Upload />
        Export
      </Button>
      {open && !disabled && (
        <div
          className="absolute right-0 mt-1 flex flex-col rounded-md border shadow-lg z-10"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            minWidth: '8rem',
          }}
        >
          <button
            onClick={() => handleExport('csv')}
            data-testid="glossary-export-csv"
            className="px-3 py-2 text-sm text-left hover:opacity-80"
            style={{ color: 'var(--color-text)' }}
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('tbx')}
            data-testid="glossary-export-tbx"
            className="px-3 py-2 text-sm text-left hover:opacity-80 border-t"
            style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            TBX
          </button>
          <button
            onClick={() => handleExport('tsv')}
            disabled={!tsvLang}
            data-testid="glossary-export-tsv"
            className="px-3 py-2 text-sm text-left hover:opacity-80 border-t disabled:opacity-40"
            style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            OmegaT TSV
          </button>
        </div>
      )}
    </div>
  )
}
