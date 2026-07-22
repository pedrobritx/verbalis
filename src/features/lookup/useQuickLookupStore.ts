import { create } from 'zustand'

export interface LookupLangs {
  source: string
  target: string
}

interface QuickLookupState {
  open: boolean
  prefill: string
  /** Effective languages to seed the lookup with (project langs when opened from
   * inside a project, else undefined → fall back to the global lookup defaults). */
  sourceLang?: string
  targetLang?: string
  /** The active project's languages, published by the editor while mounted so
   * every lookup trigger defaults to them without prop-drilling. */
  projectLangs: LookupLangs | null
  openWith: (prefill?: string, langs?: LookupLangs) => void
  setProjectLangs: (langs: LookupLangs | null) => void
  /** Matches the `setOpen(boolean)` convention shared by the other disclosure
   * stores (concordance, add-term, find-replace, …). */
  setOpen: (open: boolean) => void
}

export const useQuickLookupStore = create<QuickLookupState>((set, get) => ({
  open: false,
  prefill: '',
  sourceLang: undefined,
  targetLang: undefined,
  projectLangs: null,
  openWith: (prefill = '', langs) => {
    const effective = langs ?? get().projectLangs ?? undefined
    set({
      open: true,
      prefill,
      sourceLang: effective?.source,
      targetLang: effective?.target,
    })
  },
  setProjectLangs: (projectLangs) => set({ projectLangs }),
  setOpen: (open) => set(open ? { open } : { open: false, prefill: '' }),
}))
