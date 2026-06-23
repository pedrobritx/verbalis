import { create } from 'zustand'
import type { GlossaryEntry } from '@/core/types'
import type { GlossaryEditDraft } from '@/features/terminology/GlossaryEditDialog'

function toDraft(entry: GlossaryEntry): GlossaryEditDraft {
  return {
    id: entry.id,
    term: entry.term,
    definition: entry.definition,
    translations: Object.entries(entry.translations).map(([lang, value]) => ({ lang, value })),
    notes: entry.notes ?? '',
    projectId: entry.projectId,
  }
}

interface GlossaryEditState {
  open: boolean
  draft: GlossaryEditDraft | null
  /** Open the full edit dialog for an existing glossary entry. */
  openEntry: (entry: GlossaryEntry) => void
  setOpen: (open: boolean) => void
}

export const useGlossaryEditStore = create<GlossaryEditState>((set) => ({
  open: false,
  draft: null,
  openEntry: (entry) => set({ open: true, draft: toDraft(entry) }),
  setOpen: (open) => set({ open }),
}))
