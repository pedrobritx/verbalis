import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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
import { projectRepo } from '@/storage/repositories/projectRepo'
import { useProjectDialogsStore } from './useProjectDialogsStore'

export function EditProjectDialog() {
  const kind = useProjectDialogsStore((s) => s.kind)
  const projectId = useProjectDialogsStore((s) => s.projectId)
  const close = useProjectDialogsStore((s) => s.close)
  const open = kind === 'edit' && Boolean(projectId)

  const project = useLiveQuery(
    () => (projectId ? projectRepo.getById(projectId) : undefined),
    [projectId],
  )

  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && project) {
      setName(project.name)
      setSourceLang(project.sourceLang)
      setTargetLang(project.targetLang)
    }
  }, [open, project])

  const langChanged =
    project != null && (sourceLang !== project.sourceLang || targetLang !== project.targetLang)
  const canSave =
    name.trim().length > 0 && sourceLang !== targetLang && !saving && project != null

  const save = async () => {
    if (!projectId || !canSave) return
    setSaving(true)
    try {
      await projectRepo.update(projectId, {
        name: name.trim(),
        sourceLang,
        targetLang,
      })
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="edit-project-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Edit project</DialogTitle>
          <DialogDescription>Rename the project or change its language pair.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="edit-project-name"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-src-lang">Source</Label>
              <Select
                id="edit-src-lang"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                data-testid="edit-src-lang"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-tgt-lang">Target</Label>
              <Select
                id="edit-tgt-lang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                data-testid="edit-tgt-lang"
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
          {langChanged && sourceLang !== targetLang && (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="edit-lang-note">
              Changing the language pair affects which translation-memory entries match this
              project. Existing translations are kept.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="plain" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave} data-testid="edit-project-save">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
