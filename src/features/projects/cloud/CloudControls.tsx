import { lazy, Suspense, useState } from 'react'
import { Cloud, UploadCloud, Loader2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Project } from '@/core/types'
import { isCloudConfigured } from '@/storage/cloud/supabaseClient'
import { useAuthStore } from '@/features/account/useAuthStore'

// The members dialog (and its cloud logic) loads only when actually opened.
const ManageMembersDialog = lazy(() =>
  import('./ManageMembersDialog').then((m) => ({ default: m.ManageMembersDialog })),
)

/**
 * Cloud-project controls for the projects list (ROADMAP §4.1). All self-gate on
 * `isCloudConfigured()` (and, where relevant, a signed-in session), so a
 * local-only deployment renders nothing new. The heavy publish/open logic is
 * dynamically imported on demand, keeping the projects route lean.
 */

/** Small "Cloud" marker shown on a card once the project is published/opened. */
export function CloudBadge({ project }: { project: Project }) {
  if (!isCloudConfigured() || !project.cloud) return null
  return (
    <Badge variant="outline" className="gap-1" style={{ color: 'var(--color-accent)' }} data-testid="cloud-badge">
      <Cloud size={12} /> Cloud
    </Badge>
  )
}

/** Owner action: publish a local project to the cloud. Hidden once published. */
export function PublishCloudButton({ project }: { project: Project }) {
  const status = useAuthStore((s) => s.status)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!isCloudConfigured() || project.cloud || status !== 'authenticated') return null

  const publish = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const { publishProject } = await import('@/storage/cloud/projectCloud')
      await publishProject(project.id)
      // On success the project row gains `cloud`; the card re-renders via
      // useLiveQuery and this button is replaced by the CloudBadge.
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      aria-label={failed ? 'Publish failed — retry' : 'Publish to cloud'}
      title={failed ? 'Publish failed — retry' : 'Publish to cloud'}
      onClick={publish}
      disabled={busy}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-fill)]"
      style={{ color: failed ? 'var(--color-error)' : 'var(--color-muted)' }}
      data-testid="publish-cloud"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
    </button>
  )
}

/** Card action: manage a published project's members. Shown once cloud-linked. */
export function ManageMembersButton({ project }: { project: Project }) {
  const status = useAuthStore((s) => s.status)
  const [open, setOpen] = useState(false)
  if (!isCloudConfigured() || !project.cloud || status !== 'authenticated') return null
  return (
    <>
      <button
        type="button"
        aria-label="Manage members"
        title="Manage members"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-fill)]"
        style={{ color: 'var(--color-muted)' }}
        data-testid="manage-members"
      >
        <Users size={16} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ManageMembersDialog project={project} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  )
}

/** Header action opening the "open a cloud project" dialog. Signed-in only. */
export function OpenFromCloudButton({ onClick }: { onClick: () => void }) {
  const status = useAuthStore((s) => s.status)
  if (!isCloudConfigured() || status !== 'authenticated') return null
  return (
    <Button variant="bordered" onClick={onClick} data-testid="open-from-cloud">
      <Cloud />
      Open from cloud
    </Button>
  )
}
