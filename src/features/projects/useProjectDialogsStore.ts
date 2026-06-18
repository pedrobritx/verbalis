import { create } from 'zustand'

export type ProjectDialogKind = 'edit' | 'delete' | 'duplicate'

interface ProjectDialogsState {
  kind: ProjectDialogKind | null
  projectId: string | null
  open: (kind: ProjectDialogKind, projectId: string) => void
  close: () => void
}

/**
 * Drives the global project Edit / Delete / Duplicate dialogs so they can be
 * triggered from the projects list, the editor header, or the command palette.
 */
export const useProjectDialogsStore = create<ProjectDialogsState>((set) => ({
  kind: null,
  projectId: null,
  open: (kind, projectId) => set({ kind, projectId }),
  close: () => set({ kind: null, projectId: null }),
}))
