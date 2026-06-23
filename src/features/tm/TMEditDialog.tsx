import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Project, TMEntry } from '@/core/types'

const UNASSIGNED = '__unassigned__'

interface TMEditDialogProps {
  open: boolean
  entry: TMEntry | null
  projects: Project[]
  onOpenChange: (open: boolean) => void
  onSave: (id: string, changes: Pick<TMEntry, 'source' | 'target' | 'projectId'>) => Promise<void> | void
}

export function TMEditDialog({ open, entry, projects, onOpenChange, onSave }: TMEditDialogProps) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [projectId, setProjectId] = useState<string>(UNASSIGNED)

  useEffect(() => {
    if (!entry) return
    setSource(entry.source)
    setTarget(entry.target)
    setProjectId(entry.projectId ?? UNASSIGNED)
  }, [entry])

  const save = async () => {
    if (!entry) return
    await onSave(entry.id, {
      source: source.trim(),
      target: target.trim(),
      projectId: projectId === UNASSIGNED ? undefined : projectId,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="tm-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Edit TM entry</DialogTitle>
          <DialogDescription>
            {entry ? `${entry.sourceLang} → ${entry.targetLang}` : ''} · the language pair is the
            match key and can't be changed here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tm-edit-source">Source</Label>
            <Textarea
              id="tm-edit-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={2}
              data-testid="tm-edit-source"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tm-edit-target">Target</Label>
            <Textarea
              id="tm-edit-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              rows={2}
              data-testid="tm-edit-target"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tm-edit-project">Project</Label>
            <Select
              id="tm-edit-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              data-testid="tm-edit-project"
            >
              <option value={UNASSIGNED}>Unassigned (global)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="bordered" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!source.trim() || !target.trim()}
              data-testid="tm-edit-save"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
