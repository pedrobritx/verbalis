import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { CloudProjectSummary } from '@/storage/cloud/projectCloud'

/**
 * Lists the cloud projects the signed-in user is a member of (member-scoped by
 * RLS) and opens one into a local Dexie copy (ROADMAP §4.1). Loading a project
 * hydrates its segments from the cloud snapshot, then navigates to it. Cloud
 * code is dynamically imported so the projects route stays local-only-light.
 */
export function OpenCloudProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState<CloudProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setItems(null)
    setError(null)
    void (async () => {
      try {
        const [{ getSupabase }, { listCloudProjects }] = await Promise.all([
          import('@/storage/cloud/supabaseClient'),
          import('@/storage/cloud/projectCloud'),
        ])
        const client = await getSupabase()
        const list = await listCloudProjects(client)
        if (alive) setItems(list)
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Could not load cloud projects.')
          setItems([])
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [open])

  const openProject = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const { openCloudProject } = await import('@/storage/cloud/projectCloud')
      const localId = await openCloudProject(id)
      if (localId) {
        onOpenChange(false)
        navigate(`/project/${localId}`)
      } else {
        setError('You are not a member of that project.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the project.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="open-cloud-dialog"
      >
        <DialogHeader>
          <DialogTitle>Open a cloud project</DialogTitle>
          <DialogDescription>
            Projects shared with your account. Opening one syncs a local copy you can translate.
          </DialogDescription>
        </DialogHeader>

        {items === null ? (
          <div
            className="flex items-center justify-center gap-2 py-6"
            style={{ color: 'var(--color-muted)' }}
          >
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p
            className="py-4 text-sm"
            style={{ color: 'var(--color-muted)' }}
            data-testid="cloud-projects-empty"
          >
            No cloud projects yet. Publish one from the projects list to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="cloud-projects-list">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {p.name}
                  </p>
                  <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
                    {p.sourceLang} → {p.targetLang}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => openProject(p.id)}
                  disabled={busyId !== null}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-[var(--color-fill)]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  data-testid={`open-cloud-${p.id}`}
                >
                  {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : null}
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p
            className="text-sm"
            style={{ color: 'var(--color-error)' }}
            data-testid="open-cloud-error"
          >
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
