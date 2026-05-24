import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportCSV } from '@/core/glossary/csv'
import { exportTBX } from '@/core/glossary/tbx'
import type { GlossaryEntry } from '@/core/types'

interface GlossaryExportButtonProps {
  entries: GlossaryEntry[]
  sourceLang?: string
}

function buildFilename(format: 'csv' | 'tbx'): string {
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

export function GlossaryExportButton({ entries, sourceLang }: GlossaryExportButtonProps) {
  const [open, setOpen] = useState(false)
  const disabled = entries.length === 0

  function handleExport(format: 'csv' | 'tbx') {
    if (format === 'csv') {
      download(exportCSV(entries, sourceLang), 'text/csv', buildFilename('csv'))
    } else {
      download(exportTBX(entries, sourceLang ?? 'en'), 'application/xml', buildFilename('tbx'))
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
        </div>
      )}
    </div>
  )
}
