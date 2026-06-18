import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
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
import { projectRepo } from '@/storage/repositories/projectRepo'
import { useProjectDialogsStore } from './useProjectDialogsStore'

export function DeleteProjectDialog() {
  const kind = useProjectDialogsStore((s) => s.kind)
  const projectId = useProjectDialogsStore((s) => s.projectId)
  const close = useProjectDialogsStore((s) => s.close)
  const open = kind === 'delete' && Boolean(projectId)

  const navigate = useNavigate()
  const { pathname } = useLocation()

  const project = useLiveQuery(
    () => (projectId ? projectRepo.getById(projectId) : undefined),
    [projectId],
  )
  const stats = useLiveQuery(
    () => (projectId ? projectRepo.deletionStats(projectId) : undefined),
    [projectId],
  )

  const [confirmText, setConfirmText] = useState('')
  const [deleteResources, setDeleteResources] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmText('')
      setDeleteResources(false)
    }
  }, [open, projectId])

  // Type-to-confirm guards against accidental, irreversible deletion.
  const confirmed = project != null && confirmText.trim() === project.name
  const hasResources = (stats?.tmEntries ?? 0) + (stats?.glossaryEntries ?? 0) > 0

  const handleDelete = async () => {
    if (!projectId || !confirmed) return
    setDeleting(true)
    try {
      await projectRepo.removeCascade(projectId, { deleteResources })
      close()
      // If we were inside this project's editor, leave it.
      if (pathname.startsWith(`/project/${projectId}`)) navigate('/')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-md"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="delete-project-dialog"
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: 'var(--color-error)' }}
          >
            <AlertTriangle size={18} />
            Delete project
          </DialogTitle>
          <DialogDescription>
            This permanently deletes <strong>{project?.name}</strong> and its{' '}
            {stats?.segments ?? 0} segment{stats?.segments === 1 ? '' : 's'}. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {hasResources && (
            <label
              className="flex items-start gap-2 rounded-md border p-2.5 text-footnote"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              <input
                type="checkbox"
                checked={deleteResources}
                onChange={(e) => setDeleteResources(e.target.checked)}
                className="mt-0.5"
                data-testid="delete-resources"
              />
              <span>
                Also delete this project&apos;s {stats?.tmEntries ?? 0} translation-memory and{' '}
                {stats?.glossaryEntries ?? 0} glossary entries. Leave unchecked to keep them for
                reuse in other projects.
              </span>
            </label>
          )}

          <div className="grid gap-1.5">
            <label
              htmlFor="delete-confirm"
              className="text-footnote"
              style={{ color: 'var(--color-muted)' }}
            >
              Type <strong style={{ color: 'var(--color-text)' }}>{project?.name}</strong> to
              confirm.
            </label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              data-testid="delete-confirm-input"
              autoFocus
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="plain" onClick={close} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={!confirmed || deleting}
            data-testid="delete-project-confirm"
          >
            {deleting ? 'Deleting…' : 'Delete project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
