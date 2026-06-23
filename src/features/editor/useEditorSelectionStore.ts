import { create } from 'zustand'

/**
 * The translator's most recent text selection inside the editor (from either the
 * source or target cell, plain textarea or rich editor). The Lookup sidebar panel
 * reads this to seed definition / MT / TM / web-search queries, so a word can be
 * looked up without leaving the row.
 */
interface EditorSelectionState {
  text: string
  setText: (text: string) => void
  clear: () => void
}

export const useEditorSelectionStore = create<EditorSelectionState>((set) => ({
  text: '',
  // Only meaningful, non-whitespace selections are worth surfacing.
  setText: (text) => set({ text: text.trim() }),
  clear: () => set({ text: '' }),
}))
