import { create } from 'zustand'
import type { MTProviderId } from '@/core/types'

export interface EditorActions {
  markCurrentReviewed: () => void
  jumpToNextWithStatus: (status: 'untranslated' | 'draft' | 'translated' | 'reviewed') => void
  jumpToSegment: (oneBasedIndex: number) => void
  translateCurrentWithMT: (providerId?: MTProviderId) => Promise<void>
}

interface EditorActionsState {
  actions: EditorActions | null
  setActions: (actions: EditorActions | null) => void
}

export const useEditorActionsStore = create<EditorActionsState>((set) => ({
  actions: null,
  setActions: (actions) => set({ actions }),
}))
