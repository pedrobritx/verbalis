import { create } from 'zustand'
import type { ProjectRole, WorkflowStage } from '@/core/types'
import { forcesSuggesting, workflowCapabilities } from '@/core/workflow/rules'

/**
 * The open project's effective role + workflow stage (ROADMAP §5.2), published by
 * `EditorPage` and read by the edit-mode toggle and the changes UI to gate
 * editing. The default is the permissive "PM-of-self" (project_manager /
 * translation), so before a project resolves — and for every local-only project —
 * nothing is restricted and behaviour is byte-identical to the pre-roles app.
 */
interface WorkflowState {
  role: ProjectRole
  stage: WorkflowStage
  set: (role: ProjectRole, stage: WorkflowStage) => void
  reset: () => void
}

const DEFAULT: Pick<WorkflowState, 'role' | 'stage'> = {
  role: 'project_manager',
  stage: 'translation',
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...DEFAULT,
  set: (role, stage) => set({ role, stage }),
  reset: () => set(DEFAULT),
}))

/** Whether the current role may accept/reject tracked changes (revisor / PM). */
export function useCanResolveChanges(): boolean {
  return useWorkflowStore(
    (s) => workflowCapabilities(s.role, s.stage, 'translated').canResolveChanges,
  )
}

/** Whether the current role/stage forces suggesting mode (translator in review). */
export function useForcesSuggesting(): boolean {
  return useWorkflowStore((s) => forcesSuggesting(s.role, s.stage))
}

/** Whether the current role may perform review actions incl. sign-off (revisor / PM). */
export function useCanReview(): boolean {
  return useWorkflowStore((s) => workflowCapabilities(s.role, s.stage, 'translated').canReview)
}
