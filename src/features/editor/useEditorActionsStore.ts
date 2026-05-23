import { create } from 'zustand'

export interface EditorActions {
  markCurrentReviewed: () => void
  jumpToNextWithStatus: (status: 'untranslated' | 'draft' | 'translated' | 'reviewed') => void
  jumpToSegment: (oneBasedIndex: number) => void
}

interface EditorActionsState {
  actions: EditorActions | null
  setActions: (actions: EditorActions | null) => void
}

export const useEditorActionsStore = create<EditorActionsState>((set) => ({
  actions: null,
  setActions: (actions) => set({ actions }),
}))
