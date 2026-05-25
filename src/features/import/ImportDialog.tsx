import { useState } from 'react'
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
import { useImportProject } from './useImportProject'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { importProject, isImporting, error } = useImportProject()
  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [file, setFile] = useState<File | null>(null)

  function reset() {
    setName('')
    setSourceLang('en')
    setTargetLang('es')
    setFile(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !name) setName(stripExtension(f.name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim() || sourceLang === targetLang) return
    try {
      await importProject({ file, name: name.trim(), sourceLang, targetLang })
      reset()
      onOpenChange(false)
    } catch {
      // error surfaced via hook state
    }
  }

  const canSubmit = Boolean(file) && name.trim().length > 0 && sourceLang !== targetLang && !isImporting

  return (
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
          <DialogDescription>Create a new project from a TXT, MD, or DOCX file.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="import-file">Source file</Label>
            <Input
              id="import-file"
              type="file"
              accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              required
            />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="src-lang">Source</Label>
              <Select id="src-lang" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tgt-lang">Target</Label>
              <Select id="tgt-lang" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
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
  )
}
