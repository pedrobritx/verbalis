import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LANGUAGE_OPTIONS } from '@/core/i18n/languages'
import { HardDriveUpload } from 'lucide-react'
import { ConnectorFilePicker } from '@/extensions/connectors/ConnectorFilePicker'
import type { ConnectorFile, StorageConnector } from '@/extensions/connectors/types'
import { isGdriveAvailable } from '@/extensions/connectors/gdrive/config'
import { isOnedriveAvailable } from '@/extensions/connectors/onedrive/config'
import { useImportProject } from './useImportProject'
import {
  getLookupSettings,
  settingsRepo,
  LOOKUP_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const IMPORTABLE_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx', '.xlf', '.xliff', '.mqxliff']

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

/** True when a cloud file is one of the formats the import flow understands. */
function isImportable(file: ConnectorFile): boolean {
  const n = file.name.toLowerCase()
  return IMPORTABLE_EXTENSIONS.some((ext) => n.endsWith(ext))
}

function isBilingual(file: File | null): boolean {
  if (!file) return false
  const n = file.name.toLowerCase()
  return n.endsWith('.xlf') || n.endsWith('.xliff') || n.endsWith('.mqxliff')
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { importProject, isImporting, error } = useImportProject()
  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [file, setFile] = useState<File | null>(null)
  const [connector, setConnector] = useState<StorageConnector | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const gdrive = isGdriveAvailable()
  const onedrive = isOnedriveAvailable()

  // Seed the language pair from the user's saved lookup defaults / last-used
  // languages when the dialog opens, instead of a fixed guess. Falls back to a
  // sensible distinct pair (this is a PT↔EN-oriented tool) so the monolingual
  // "source ≠ target" guard is satisfied out of the box.
  useEffect(() => {
    if (!open) return
    void getLookupSettings().then((l) => {
      const target = l.defaultTargetLang
      const source =
        l.lastSourceLang && l.lastSourceLang !== target
          ? l.lastSourceLang
          : target === 'en'
            ? 'pt'
            : 'en'
      setSourceLang(source)
      setTargetLang(target)
    })
  }, [open])

  function reset() {
    setName('')
    setSourceLang('en')
    setTargetLang('es')
    setFile(null)
    setPickerOpen(false)
  }

  function acceptPickedFile(f: File) {
    setFile(f)
    if (!name) setName(stripExtension(f.name))
  }

  async function openDrivePicker() {
    // The Drive connector (GIS + REST) is loaded only on demand, so it never
    // weighs on the initial bundle.
    const { gdriveConnector } = await import('@/extensions/connectors/gdrive')
    setConnector(gdriveConnector)
    setPickerOpen(true)
  }

  async function openOnedrivePicker() {
    // MSAL + the Graph layer load only on demand, off the initial bundle.
    const { onedriveConnector } = await import('@/extensions/connectors/onedrive')
    setConnector(onedriveConnector)
    setPickerOpen(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !name) setName(stripExtension(f.name))
  }

  const bilingual = isBilingual(file)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) return
    if (!bilingual && sourceLang === targetLang) return
    try {
      await importProject({ file, name: name.trim(), sourceLang, targetLang })
      // Remember the working languages so the next import and the quick lookup
      // default to them.
      void settingsRepo.set(LOOKUP_SETTINGS_KEY, {
        defaultTargetLang: targetLang,
        lastSourceLang: sourceLang,
      })
      reset()
      onOpenChange(false)
    } catch {
      // error surfaced via hook state
    }
  }

  const canSubmit =
    Boolean(file) &&
    name.trim().length > 0 &&
    (bilingual || sourceLang !== targetLang) &&
    !isImporting

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Import file</DialogTitle>
          <DialogDescription>
            Create a new project from a TXT, MD, DOCX, or XLIFF (XLF / mqxliff) file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="import-file">Source file</Label>
            <Input
              id="import-file"
              type="file"
              accept=".txt,.md,.docx,.xlf,.xliff,.mqxliff,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/xml,text/xml"
              onChange={handleFileChange}
              required={!file}
            />
            {(gdrive || onedrive) && (
              <div className="flex flex-wrap gap-2">
                {gdrive && (
                  <Button
                    type="button"
                    variant="plain"
                    className="w-fit"
                    onClick={() => void openDrivePicker()}
                    data-testid="import-from-gdrive"
                  >
                    <HardDriveUpload size={14} />
                    From Google Drive
                  </Button>
                )}
                {onedrive && (
                  <Button
                    type="button"
                    variant="plain"
                    className="w-fit"
                    onClick={() => void openOnedrivePicker()}
                    data-testid="import-from-onedrive"
                  >
                    <HardDriveUpload size={14} />
                    From OneDrive
                  </Button>
                )}
              </div>
            )}
            {file && (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="import-selected-file">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="import-name">Project name</Label>
            <Input
              id="import-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My document"
              required
            />
          </div>

          {bilingual ? (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Source and target languages are read from the XLIFF file.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="src-lang">Source</Label>
                  <Select
                    id="src-lang"
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label} ({l.code})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tgt-lang">Target</Label>
                  <Select
                    id="tgt-lang"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label} ({l.code})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {sourceLang === targetLang && (
                <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                  Source and target languages must differ.
                </p>
              )}
            </>
          )}

          {error && (
            <p className="text-xs" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="plain"
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isImporting ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {connector && (
      <ConnectorFilePicker
        connector={connector}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        accept={isImportable}
        onPick={acceptPickedFile}
      />
    )}
    </>
  )
}
