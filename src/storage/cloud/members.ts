import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectRole } from '@/core/types'

/**
 * Member management for a cloud project (ROADMAP §5.1, D8). Pure client-injected
 * data functions (vitest passes a mock) over the `project_members` + `profiles`
 * tables and the `invite_member` RPC:
 *
 *  - `listMembers` joins the roster to profiles for names/emails (member-scoped
 *    reads by RLS).
 *  - `inviteMember` calls the SECURITY DEFINER RPC, which resolves the email to a
 *    user id and upserts the membership — all behind a project_manager check, so
 *    no id/email enumeration surface is exposed and a non-PM is server-rejected.
 *  - `changeMemberRole` / `removeMember` are direct writes gated by PM-only RLS
 *    and the ≥1-project_manager trigger (both raise, surfaced as thrown errors).
 *
 * Strictly additive: loaded only when a signed-in user opens the Members panel.
 */

export interface ProjectMember {
  userId: string
  role: ProjectRole
  displayName: string | null
  email: string | null
  /** True for the signed-in user's own row (guards self-demotion / self-removal in the UI). */
  isSelf: boolean
}

export type InviteResult = { status: 'invited'; userId: string } | { status: 'not_found' }

const ROLE_ORDER: Record<ProjectRole, number> = { project_manager: 0, revisor: 1, translator: 2 }

/** The roster for a cloud project, joined to profile names/emails. */
export async function listMembers(
  client: SupabaseClient,
  cloudId: string,
  selfUserId: string,
): Promise<ProjectMember[]> {
  const membersRes = await client
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', cloudId)
  if (membersRes.error) throw new Error(membersRes.error.message)
  const rows = (membersRes.data as { user_id: string; role: ProjectRole }[] | null) ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.user_id)
  const profRes = await client.from('profiles').select('id, display_name, email').in('id', ids)
  if (profRes.error) throw new Error(profRes.error.message)
  const profiles = new Map(
    ((profRes.data as { id: string; display_name: string | null; email: string | null }[] | null) ?? []).map(
      (p) => [p.id, p] as const,
    ),
  )

  return rows
    .map((r): ProjectMember => {
      const p = profiles.get(r.user_id)
      return {
        userId: r.user_id,
        role: r.role,
        displayName: p?.display_name ?? null,
        email: p?.email ?? null,
        isSelf: r.user_id === selfUserId,
      }
    })
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? ''),
    )
}

/** Invite (or re-role) a user by email via the PM-only RPC. */
export async function inviteMember(
  client: SupabaseClient,
  cloudId: string,
  email: string,
  role: ProjectRole,
): Promise<InviteResult> {
  const { data, error } = await client.rpc('invite_member', {
    p_project_id: cloudId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
  return data ? { status: 'invited', userId: data as string } : { status: 'not_found' }
}

/** Change a member's role (PM-only RLS; the ≥1-PM trigger blocks the last demotion). */
export async function changeMemberRole(
  client: SupabaseClient,
  cloudId: string,
  userId: string,
  role: ProjectRole,
): Promise<void> {
  const { error } = await client
    .from('project_members')
    .update({ role })
    .eq('project_id', cloudId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/** Remove a member (PM-only RLS; the ≥1-PM trigger blocks removing the last manager). */
export async function removeMember(
  client: SupabaseClient,
  cloudId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('project_members')
    .delete()
    .eq('project_id', cloudId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}
