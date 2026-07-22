import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
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
import { projectRepo } from '@/storage/repositories/projectRepo'
import { useProjectDialogsStore } from './useProjectDialogsStore'

export function DuplicateProjectDialog() {
  const kind = useProjectDialogsStore((s) => s.kind)
  const projectId = useProjectDialogsStore((s) => s.projectId)
  const close = useProjectDialogsStore((s) => s.close)
  const open = kind === 'duplicate' && Boolean(projectId)
  const navigate = useNavigate()

  const project = useLiveQuery(
    () => (projectId ? projectRepo.getById(projectId) : undefined),
    [projectId],
  )

  const [name, setName] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (open && project) setName(`${project.name} (copy)`)
  }, [open, project])

  const duplicate = async () => {
    if (!projectId || !name.trim()) return
    setWorking(true)
    try {
      const newId = await projectRepo.duplicate(projectId, name)
      close()
      if (newId) navigate(`/project/${newId}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="duplicate-project-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>Duplicate project</DialogTitle>
          <DialogDescription>
            Creates a copy with all segments and their current translations.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void duplicate()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="duplicate-name">New project name</Label>
            <Input
              id="duplicate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="duplicate-name"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="plain" onClick={close} disabled={working}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || working}
              data-testid="duplicate-confirm"
            >
              {working ? 'Duplicating…' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
