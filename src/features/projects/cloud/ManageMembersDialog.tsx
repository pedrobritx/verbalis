import { useEffect, useState } from 'react'
import { Loader2, UserPlus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project, ProjectRole, WorkflowStage } from '@/core/types'
import type { ProjectMember } from '@/storage/cloud/members'
import type * as MembersModule from '@/storage/cloud/members'
import { useAuthStore } from '@/features/account/useAuthStore'

/**
 * Manage a cloud project's members (ROADMAP §5.1). A project_manager can invite
 * by email, change roles, and remove members; everyone else sees a read-only
 * roster. All member logic is dynamically imported so the projects route stays
 * local-only-light; the server (PM-only RLS + the ≥1-manager trigger) is the
 * real gate — the UI only mirrors it.
 */

const ROLES: ProjectRole[] = ['project_manager', 'translator', 'revisor']
const ROLE_LABEL: Record<ProjectRole, string> = {
  project_manager: 'Project manager',
  translator: 'Translator',
  revisor: 'Revisor',
}
const STAGES: WorkflowStage[] = ['translation', 'review', 'final']
const STAGE_LABEL: Record<WorkflowStage, string> = {
  translation: 'Translation',
  review: 'Review',
  final: 'Final',
}

export function ManageMembersDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const selfUserId = useAuthStore((s) => s.user?.id ?? null)
  const isManager = project.cloud?.role === 'project_manager'
  const cloudId = project.cloud?.id

  const [members, setMembers] = useState<ProjectMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ProjectRole>('translator')
  const [stage, setStage] = useState<WorkflowStage>(project.cloud?.stage ?? 'translation')

  useEffect(() => {
    setStage(project.cloud?.stage ?? 'translation')
  }, [project.cloud?.stage])

  const loadCtx = async (): Promise<{ client: SupabaseClient; m: typeof MembersModule }> => {
    const [{ getSupabase }, m] = await Promise.all([
      import('@/storage/cloud/supabaseClient'),
      import('@/storage/cloud/members'),
    ])
    return { client: await getSupabase(), m }
  }

  const load = async () => {
    if (!cloudId || !selfUserId) return
    setError(null)
    try {
      const { client, m } = await loadCtx()
      setMembers(await m.listMembers(client, cloudId, selfUserId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members.')
      setMembers([])
    }
  }

  useEffect(() => {
    if (!open) return
    setMembers(null)
    setNotice(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cloudId, selfUserId])

  /** Run a member mutation with busy/error handling, then refresh the roster. */
  const runAction = async (
    fn: (ctx: { client: SupabaseClient; m: typeof MembersModule }) => Promise<'reload' | 'skip'>,
  ) => {
    if (!cloudId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const ctx = await loadCtx()
      if ((await fn(ctx)) === 'reload') await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const invite = () =>
    runAction(async ({ client, m }) => {
      const email = inviteEmail.trim()
      const res = await m.inviteMember(client, cloudId!, email, inviteRole)
      if (res.status === 'not_found') {
        setNotice(
          `No Verbalis account uses ${email} yet. Ask them to sign in once, then invite again.`,
        )
        return 'skip'
      }
      setInviteEmail('')
      setNotice(`Invited ${email} as ${ROLE_LABEL[inviteRole].toLowerCase()}.`)
      return 'reload'
    })

  const changeRole = (userId: string, role: ProjectRole) =>
    runAction(async ({ client, m }) => {
      await m.changeMemberRole(client, cloudId!, userId, role)
      return 'reload'
    })

  const remove = (userId: string) =>
    runAction(async ({ client, m }) => {
      await m.removeMember(client, cloudId!, userId)
      return 'reload'
    })

  const changeStage = async (next: WorkflowStage) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { changeProjectStage } = await import('@/storage/cloud/projectCloud')
      await changeProjectStage(project.id, next)
      setStage(next)
      setNotice(`Workflow stage set to ${STAGE_LABEL[next].toLowerCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the stage.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="manage-members-dialog"
      >
        <DialogHeader>
          <DialogTitle>Members — {project.name}</DialogTitle>
          <DialogDescription>
            {isManager
              ? 'Invite teammates by email and set each person’s role.'
              : 'The team on this cloud project. Only a project manager can make changes.'}
          </DialogDescription>
        </DialogHeader>

        {isManager && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void invite()
            }}
            data-testid="invite-form"
          >
            <Input
              type="email"
              required
              placeholder="teammate@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-0 flex-1"
              data-testid="invite-email"
            />
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              data-testid="invite-role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              disabled={busy || !inviteEmail.trim()}
              data-testid="invite-submit"
            >
              <UserPlus size={16} /> Invite
            </Button>
          </form>
        )}

        <div
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--color-border)' }}
          data-testid="stage-control"
        >
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Workflow stage
          </span>
          {isManager ? (
            <Select
              value={stage}
              disabled={busy}
              onChange={(e) => void changeStage(e.target.value as WorkflowStage)}
              data-testid="workflow-stage"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </Select>
          ) : (
            <Badge
              variant="outline"
              style={{ color: 'var(--color-muted)' }}
              data-testid="workflow-stage-readonly"
            >
              {STAGE_LABEL[stage]}
            </Badge>
          )}
        </div>

        {members === null ? (
          <div
            className="flex items-center justify-center gap-2 py-6"
            style={{ color: 'var(--color-muted)' }}
          >
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="members-list">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
                data-testid={`member-${m.userId}`}
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {m.displayName || m.email || 'Member'}
                    {m.isSelf && <span style={{ color: 'var(--color-muted)' }}> (you)</span>}
                  </p>
                  {m.email && m.displayName && (
                    <p className="truncate text-xs" style={{ color: 'var(--color-muted)' }}>
                      {m.email}
                    </p>
                  )}
                </div>
                {isManager ? (
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => void changeRole(m.userId, e.target.value as ProjectRole)}
                      data-testid={`member-role-${m.userId}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => void remove(m.userId)}
                      disabled={busy}
                      aria-label={`Remove ${m.displayName || m.email || 'member'}`}
                      title="Remove from project"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-fill)]"
                      style={{ color: 'var(--color-muted)' }}
                      data-testid={`member-remove-${m.userId}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {notice ? (
          <p
            className="text-sm"
            style={{ color: 'var(--color-accent)' }}
            data-testid="members-notice"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            className="text-sm"
            style={{ color: 'var(--color-error)' }}
            data-testid="members-error"
          >
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
