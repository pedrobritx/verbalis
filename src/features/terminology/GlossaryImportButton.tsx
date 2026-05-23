import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseCSV, mergeRows } from '@/core/glossary/csv'
import { parseTBX } from '@/core/glossary/tbx'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import type { GlossaryEntry } from '@/core/types'

function detectFormat(file: File, text: string): 'csv' | 'tbx' {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.tbx')) return 'tbx'
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) return 'tbx'
  return 'csv'
}

export function GlossaryImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setStatus(null)
    setError(null)
    try {
      const text = await file.text()
      const format = detectFormat(file, text)
      let parsed: Array<Omit<GlossaryEntry, 'id'>> = []
      if (format === 'csv') {
        const rows = parseCSV(text)
        parsed = mergeRows(rows)
      } else {
        const tbxEntries = parseTBX(text)
        parsed = tbxEntries.map((t) => ({
          term: t.term,
          definition: t.definition,
          translations: t.translations,
          notes: t.notes,
        }))
      }
      if (parsed.length === 0) {
        setError('No glossary entries found in file.')
        return
      }
      const entries: GlossaryEntry[] = parsed.map((p) => ({
        id: crypto.randomUUID(),
        term: p.term,
        definition: p.definition,
        translations: p.translations,
        notes: p.notes,
        projectId: p.projectId,
      }))
      await glossaryRepo.bulkAdd(entries)
      setStatus(`Imported ${entries.length} entries.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        data-testid="glossary-import-button"
      >
        <Upload />
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tbx,.xml,text/csv,application/xml,text/xml"
        className="hidden"
        data-testid="glossary-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      {status && (
        <span
          className="text-xs"
          style={{ color: 'var(--color-accent)' }}
          data-testid="glossary-import-status"
        >
          {status}
        </span>
      )}
      {error && (
        <span
          className="text-xs"
          style={{ color: '#ef4444' }}
          data-testid="glossary-import-error"
        >
          {error}
        </span>
      )}
    </div>
  )
}
