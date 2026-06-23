import { useLiveQuery } from 'dexie-react-hooks'
import { GlossaryEditDialog } from '@/features/terminology/GlossaryEditDialog'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import type { GlossaryEntry } from '@/core/types'
import { useGlossaryEditStore } from './useGlossaryEditStore'

/**
 * Renders the shared GlossaryEditDialog (from the Terminology page) inside the
 * editor, driven by `useGlossaryEditStore`, so a glossary hit in the sidebar can
 * be edited in place. Mounted once by EditorPage.
 */
export function GlossaryEditController() {
  const open = useGlossaryEditStore((s) => s.open)
  const draft = useGlossaryEditStore((s) => s.draft)
  const setOpen = useGlossaryEditStore((s) => s.setOpen)
  const projects = useLiveQuery(() => projectRepo.getAll(), []) ?? []

  const handleSave = async (entry: GlossaryEntry) => {
    const existing = await glossaryRepo.getById(entry.id)
    if (existing) {
      await glossaryRepo.update(entry.id, {
        term: entry.term,
        definition: entry.definition,
        translations: entry.translations,
        notes: entry.notes,
        projectId: entry.projectId,
      })
    } else {
      await glossaryRepo.create(entry)
    }
  }

  return (
    <GlossaryEditDialog
      open={open}
      draft={draft}
      projects={projects}
      onOpenChange={setOpen}
      onSave={handleSave}
    />
  )
}
