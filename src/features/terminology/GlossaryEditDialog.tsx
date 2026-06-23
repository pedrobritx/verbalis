import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LANG_OPTIONS } from '@/core/lang/options'
import { Textarea } from '@/components/ui/textarea'
import type { GlossaryEntry, Project } from '@/core/types'

export interface GlossaryEditDraft {
  id?: string
  term: string
  definition: string
  translations: Array<{ lang: string; value: string }>
  notes: string
  projectId?: string
}

interface GlossaryEditDialogProps {
  open: boolean
  draft: GlossaryEditDraft | null
  projects: Project[]
  onOpenChange: (open: boolean) => void
  onSave: (entry: GlossaryEntry) => Promise<void> | void
}

const UNASSIGNED = '__unassigned__'

export function GlossaryEditDialog({
  open,
  draft,
  projects,
  onOpenChange,
  onSave,
}: GlossaryEditDialogProps) {
  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const [translations, setTranslations] = useState<Array<{ lang: string; value: string }>>(
    [],
  )
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState<string>(UNASSIGNED)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft) return
    setTerm(draft.term)
    setDefinition(draft.definition)
    setTranslations(
      draft.translations.length > 0 ? draft.translations : [{ lang: '', value: '' }],
    )
    setNotes(draft.notes)
    setProjectId(draft.projectId ?? UNASSIGNED)
    setError(null)
  }, [draft])

  const handleSave = async () => {
    const trimmedTerm = term.trim()
    if (!trimmedTerm) {
      setError('Term is required')
      return
    }
    const cleaned: Record<string, string> = {}
    for (const { lang, value } of translations) {
      const l = lang.trim()
      const v = value.trim()
      if (l && v) cleaned[l] = v
    }
    const entry: GlossaryEntry = {
      id: draft?.id ?? crypto.randomUUID(),
      term: trimmedTerm,
      definition: definition.trim(),
      translations: cleaned,
      notes: notes.trim() || undefined,
      projectId: projectId === UNASSIGNED ? undefined : projectId,
    }
    await onSave(entry)
    onOpenChange(false)
  }

  const addTranslationRow = () =>
    setTranslations((rows) => [...rows, { lang: '', value: '' }])

  const updateRow = (i: number, key: 'lang' | 'value', v: string) =>
    setTranslations((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)))

  const removeRow = (i: number) =>
    setTranslations((rows) => rows.filter((_, idx) => idx !== i))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        data-testid="glossary-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text)' }}>
            {draft?.id ? 'Edit term' : 'New term'}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-muted)' }}>
            Source term, definition, and translations per target language.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="glossary-term">Term</Label>
            <Input
              id="glossary-term"
              data-testid="glossary-term-input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="glossary-definition">Definition</Label>
            <Textarea
              id="glossary-definition"
              data-testid="glossary-definition-input"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Translations</Label>
            {translations.map((row, i) => (
              <div key={i} className="grid grid-cols-[5rem_1fr_auto] gap-2 items-center">
                <Select
                  value={row.lang}
                  onChange={(e) => updateRow(i, 'lang', e.target.value)}
                  data-testid={`glossary-translation-lang-${i}`}
                >
                  <option value="">lang</option>
                  {/* Preserve a code that isn't one of our known options (e.g. imported). */}
                  {row.lang && !LANG_OPTIONS.some((o) => o.value === row.lang) && (
                    <option value={row.lang}>{row.lang}</option>
                  )}
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="translation"
                  value={row.value}
                  onChange={(e) => updateRow(i, 'value', e.target.value)}
                  data-testid={`glossary-translation-value-${i}`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove translation"
                  className="p-1 rounded transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="bordered"
              size="sm"
              onClick={addTranslationRow}
              data-testid="glossary-add-translation"
            >
              <Plus />
              Add translation
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="glossary-notes">Notes</Label>
            <Textarea
              id="glossary-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="glossary-project">Project</Label>
            <Select
              id="glossary-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value={UNASSIGNED}>Global (all projects)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="bordered" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="glossary-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
