import { create } from 'zustand'
import type { MTProviderId } from '@/core/types'
import type { WebSearchProvider } from '@/core/websearch/providers'

export interface EditorActions {
  markCurrentReviewed: () => void
  jumpToNextWithStatus: (status: 'untranslated' | 'draft' | 'translated' | 'reviewed') => void
  jumpToSegment: (oneBasedIndex: number) => void
  translateCurrentWithMT: (providerId?: MTProviderId) => Promise<void>
  /** Fill untranslated segments from TM at the configured threshold. */
  runPretranslate: () => Promise<void>
  /** Copy number-only source segments into target, converting numerals. */
  populateNumbers: () => Promise<void>
  /** Open the focused segment's source in a web-search provider (new tab). */
  webSearchCurrent: (provider: WebSearchProvider) => void
}

interface EditorActionsState {
  actions: EditorActions | null
  setActions: (actions: EditorActions | null) => void
}

export const useEditorActionsStore = create<EditorActionsState>((set) => ({
  actions: null,
  setActions: (actions) => set({ actions }),
}))
