import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseTMX } from '@/core/tm/tmx'
import { tmRepo } from '@/storage/repositories/tmRepo'
import type { TMEntry } from '@/core/types'

export function TMImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setStatus(null)
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseTMX(text)
      if (parsed.length === 0) {
        setError('No translation units found in file.')
        return
      }
      const now = new Date().toISOString()
      const entries: TMEntry[] = parsed.map((p) => ({
        id: crypto.randomUUID(),
        source: p.source,
        target: p.target,
        sourceLang: p.sourceLang,
        targetLang: p.targetLang,
        date: now,
      }))
      await tmRepo.bulkAdd(entries)
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
        data-testid="tm-import-button"
      >
        <Download />
        Import TMX
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".tmx,application/xml,text/xml"
        className="hidden"
        data-testid="tm-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      {status && (
        <span className="text-footnote" style={{ color: 'var(--color-accent)' }} data-testid="tm-import-status">
          {status}
        </span>
      )}
      {error && (
        <span className="text-footnote" style={{ color: 'var(--color-error)' }} data-testid="tm-import-error">
          {error}
        </span>
      )}
    </div>
  )
}
