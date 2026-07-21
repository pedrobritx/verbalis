import type { ProjectRole, SegmentStatus, WorkflowStage } from '@/core/types'

export type { WorkflowStage }

/**
 * Pure role-gated editing workflow (ROADMAP §5.2, D8).
 *
 * Maps `(role, stage, status)` to what a member may do, so both the UI and the
 * (client-enforced, per D8) content rules read from one source of truth. The
 * server enforces membership + write access (RLS) and the append-only authored
 * update log is the audit trail; these capabilities are the *content-level*
 * rules layered on top — the honest split documented in D8.
 *
 * Local-only projects have no cloud role, so callers resolve them as
 * "PM-of-self" via {@link effectiveRoleStage} → every capability is granted and
 * behaviour is byte-identical to the pre-roles app.
 */

export interface WorkflowCapabilities {
  /** May change the target text directly (vs. only via tracked suggestions). */
  canEditDirect: boolean
  /** May contribute text, but only as tracked suggestions (forces suggesting mode). */
  mustSuggest: boolean
  /** May accept/reject tracked changes. */
  canResolveChanges: boolean
  /** May perform review actions (mark reviewed / sign off). */
  canReview: boolean
  /** May manage the project (members, stage, deadline). */
  canManage: boolean
}

/**
 * The capabilities a member with `role` has for a segment with `status` while the
 * project is in `stage`.
 *
 * - **project_manager** — manages everything; edits directly in translation/review,
 *   and remains the only role that can touch a signed-off (`final`) project.
 * - **translator** — edits directly during `translation` (except on an already
 *   `reviewed` segment, which must be suggested), and is **forced into suggesting**
 *   during `review`.
 * - **revisor** — waits during `translation` (read-only), then edits directly and
 *   accepts/rejects during `review`.
 * - **final** — locked to everyone but a manager.
 */
export function workflowCapabilities(
  role: ProjectRole,
  stage: WorkflowStage,
  status: SegmentStatus,
): WorkflowCapabilities {
  const isManager = role === 'project_manager'
  const isRevisor = role === 'revisor'
  const isTranslator = role === 'translator'

  const canManage = isManager
  const canReview = isManager || isRevisor
  const canResolveChanges = isManager || isRevisor

  let canEditDirect = false
  let mustSuggest = false

  if (stage === 'final') {
    // Signed off: only a manager may still edit (to reopen / correct).
    canEditDirect = isManager
  } else if (isManager) {
    canEditDirect = true
  } else if (stage === 'translation') {
    if (isTranslator) {
      // A reviewed (signed-off) segment is suggested, not overwritten.
      canEditDirect = status !== 'reviewed'
      mustSuggest = !canEditDirect
    }
    // revisor: waits for the review stage (read-only, no direct edit / suggest).
  } else {
    // review stage
    if (isRevisor) canEditDirect = true
    else if (isTranslator) mustSuggest = true // forced suggesting (the §5.2 rule)
  }

  return { canEditDirect, mustSuggest, canResolveChanges, canReview, canManage }
}

/**
 * Resolve the effective `(role, stage)` for a project. A local-only project (no
 * cloud link) is "PM-of-self": project_manager in the translation stage, so every
 * capability is granted and there is zero behaviour change without an account.
 */
export function effectiveRoleStage(cloud?: {
  role: ProjectRole
  stage?: WorkflowStage
}): { role: ProjectRole; stage: WorkflowStage } {
  if (!cloud) return { role: 'project_manager', stage: 'translation' }
  return { role: cloud.role, stage: cloud.stage ?? 'translation' }
}

/**
 * Whether `role`/`stage` forces suggesting mode across the project (used to pin +
 * disable the edit-mode toggle). True for a translator during review — they can
 * contribute, but only as tracked suggestions, regardless of a segment's status.
 */
export function forcesSuggesting(role: ProjectRole, stage: WorkflowStage): boolean {
  return role === 'translator' && stage === 'review'
}
