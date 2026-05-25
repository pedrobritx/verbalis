import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseCSV, mergeRows } from '@/core/glossary/csv'
import { parseTBX } from '@/core/glossary/tbx'
import { parseTSV } from '@/core/glossary/tsv'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import type { GlossaryEntry } from '@/core/types'

type Format = 'csv' | 'tbx' | 'tsv'

function detectFormat(file: File, text: string): Format {
  const name = file.name.toLowerCase()
  if (name.endsWith('.tbx')) return 'tbx'
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.tsv') || name.endsWith('.utf8')) return 'tsv'
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) return 'tbx'
  // Heuristic for tab-separated content: first non-blank, non-comment line
  // contains a tab and no comma.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? ''
  if (firstLine.includes('\t') && !firstLine.includes(',')) return 'tsv'
  return 'csv'
}

interface GlossaryImportButtonProps {
  // OmegaT-style TSV glossaries carry no language metadata; the UI supplies
  // these defaults when present.
  defaultSourceLang?: string
  defaultTargetLang?: string
}

export function GlossaryImportButton({
  defaultSourceLang = 'en',
  defaultTargetLang = 'es',
}: GlossaryImportButtonProps = {}) {
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
      } else if (format === 'tsv') {
        const rows = parseTSV(text, defaultSourceLang, defaultTargetLang)
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
        variant="bordered"
        onClick={() => inputRef.current?.click()}
        data-testid="glossary-import-button"
      >
        <Download />
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tbx,.tsv,.utf8,.txt,.xml,text/csv,text/tab-separated-values,application/xml,text/xml"
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
          style={{ color: 'var(--color-error)' }}
          data-testid="glossary-import-error"
        >
          {error}
        </span>
      )}
    </div>
  )
}
