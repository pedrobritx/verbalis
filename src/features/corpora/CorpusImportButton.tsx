import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { parseCSV, mergeRows } from '@/core/glossary/csv'
import { parseTBX } from '@/core/glossary/tbx'
import { parseTSV } from '@/core/glossary/tsv'
import { LANG_OPTIONS } from '@/core/lang/options'
import { corpusRepo } from '@/storage/repositories/corpusRepo'
import { rowsToCorpusFile, slugifyCorpusId } from '@/core/corpus/customPack'
import type { GlossaryEntry } from '@/core/types'

type Format = 'csv' | 'tbx' | 'tsv'

function detectFormat(file: File, text: string): Format {
  const name = file.name.toLowerCase()
  if (name.endsWith('.tbx')) return 'tbx'
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.tsv') || name.endsWith('.utf8')) return 'tsv'
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) return 'tbx'
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? ''
  if (firstLine.includes('\t') && !firstLine.includes(',')) return 'tsv'
  return 'csv'
}

export function CorpusImportButton({
  defaultSourceLang = 'pt',
  defaultTargetLang = 'en',
}: {
  defaultSourceLang?: string
  defaultTargetLang?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState(defaultSourceLang)
  const [targetLang, setTargetLang] = useState(defaultTargetLang)
  const [seedTm, setSeedTm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setName('')
    setSourceLang(defaultSourceLang)
    setTargetLang(defaultTargetLang)
    setSeedTm(false)
    setError(null)
    setStatus(null)
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const text = await file.text()
      const format = detectFormat(file, text)
      let rows: Array<Omit<GlossaryEntry, 'id'>> = []
      if (format === 'csv') rows = mergeRows(parseCSV(text))
      else if (format === 'tsv') rows = mergeRows(parseTSV(text, sourceLang, targetLang))
      else rows = parseTBX(text).map((t) => ({ term: t.term, definition: t.definition, translations: t.translations, notes: t.notes }))

      const id = slugifyCorpusId(name)
      const pack = rowsToCorpusFile(rows, { id, langSource: sourceLang, langTarget: targetLang })
      if (pack.terms.length === 0) {
        setError('No usable source→target term pairs found in file.')
        return
      }
      await corpusRepo.install(pack, { label: name.trim() || 'Custom corpus' }, { seedTm })
      setStatus(`Imported ${pack.terms.length} terms.`)
      setOpen(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="bordered"
        onClick={() => {
          reset()
          setOpen(true)
        }}
        data-testid="corpus-import-button"
      >
        <Download />
        Import corpus
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-md"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          data-testid="corpus-import-dialog"
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text)' }}>Import a corpus</DialogTitle>
            <DialogDescription>
              Upload a CSV, TSV (OmegaT) or TBX termbase as a custom field corpus. It
              feeds glossary matching and quick lookup like the bundled packs.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="corpus-name">Corpus name</Label>
              <Input
                id="corpus-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pharma EN→PT"
                data-testid="corpus-import-name"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="corpus-src">Source language</Label>
                <Select
                  id="corpus-src"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  data-testid="corpus-import-src"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="corpus-tgt">Target language</Label>
                <Select
                  id="corpus-tgt"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  data-testid="corpus-import-tgt"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <label
              className="flex items-center gap-2 text-footnote select-none"
              style={{ color: 'var(--color-muted)' }}
            >
              <input
                type="checkbox"
                checked={seedTm}
                onChange={(e) => setSeedTm(e.target.checked)}
                data-testid="corpus-import-seedtm"
              />
              Also add to translation memory
            </label>

            {error && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }} data-testid="corpus-import-error">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="bordered" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                data-testid="corpus-import-choose"
              >
                {busy ? 'Importing…' : 'Choose file…'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tbx,.tsv,.utf8,.txt,.xml,text/csv,text/tab-separated-values,application/xml,text/xml"
        className="hidden"
        data-testid="corpus-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {status && (
        <span className="sr-only" data-testid="corpus-import-status">
          {status}
        </span>
      )}
    </>
  )
}
