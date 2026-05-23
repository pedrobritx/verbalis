import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { projectRepo } from '@/storage/repositories/projectRepo'
import type { GlossaryEntry, Project } from '@/core/types'
import { GlossaryTable } from './GlossaryTable'
import { GlossaryEditDialog, type GlossaryEditDraft } from './GlossaryEditDialog'
import { GlossaryImportButton } from './GlossaryImportButton'
import { GlossaryExportButton } from './GlossaryExportButton'
import { WiktionaryLookup } from './WiktionaryLookup'
import { useGlossarySearch } from './useGlossarySearch'

const ALL_PROJECTS = '__all__'
const UNASSIGNED = '__unassigned__'

function entryToDraft(entry: GlossaryEntry): GlossaryEditDraft {
  return {
    id: entry.id,
    term: entry.term,
    definition: entry.definition,
    translations: Object.entries(entry.translations).map(([lang, value]) => ({
      lang,
      value,
    })),
    notes: entry.notes ?? '',
    projectId: entry.projectId,
  }
}

const EMPTY_DRAFT: GlossaryEditDraft = {
  term: '',
  definition: '',
  translations: [{ lang: '', value: '' }],
  notes: '',
}

export default function TerminologyPage() {
  const entries = useLiveQuery(() => glossaryRepo.getAll(), [])
  const projects = useLiveQuery(() => projectRepo.getAll(), [])
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(ALL_PROJECTS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<GlossaryEditDraft | null>(null)

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>()
    if (projects) for (const p of projects) map.set(p.id, p)
    return map
  }, [projects])

  const filteredByProject = useMemo<GlossaryEntry[]>(() => {
    if (!entries) return []
    if (projectFilter === ALL_PROJECTS) return entries
    if (projectFilter === UNASSIGNED) return entries.filter((e) => !e.projectId)
    return entries.filter((e) => e.projectId === projectFilter)
  }, [entries, projectFilter])

  const searched = useGlossarySearch(filteredByProject, query)

  const filtered = useMemo(() => {
    return [...searched].sort((a, b) => a.term.localeCompare(b.term))
  }, [searched])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((e) => e.id)))
    else setSelected(new Set())
  }

  const handleDelete = async (id: string) => {
    await glossaryRepo.remove(id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    await glossaryRepo.removeMany(Array.from(selected))
    setSelected(new Set())
  }

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, translations: [{ lang: '', value: '' }] })
    setDialogOpen(true)
  }

  const openEdit = (entry: GlossaryEntry) => {
    setDraft(entryToDraft(entry))
    setDialogOpen(true)
  }

  const handleAddFromWiktionary = (next: GlossaryEditDraft) => {
    setDraft(next)
    setDialogOpen(true)
  }

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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Glossary
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {entries === undefined
              ? 'Loading…'
              : `${entries.length} total ${entries.length === 1 ? 'term' : 'terms'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openNew} data-testid="glossary-new-button">
            <Plus />
            New term
          </Button>
          <GlossaryImportButton />
          <GlossaryExportButton entries={filtered} />
        </div>
      </div>

      <WiktionaryLookup onAddToGlossary={handleAddFromWiktionary} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <Input
          placeholder="Search term, definition, or translation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="glossary-search-input"
        />
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          data-testid="glossary-project-filter"
        >
          <option value={ALL_PROJECTS}>All projects</option>
          <option value={UNASSIGNED}>Global only</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 && (
        <div
          className="flex items-center justify-between rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>
            {selected.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            data-testid="glossary-bulk-delete"
          >
            <Trash2 />
            Delete selected
          </Button>
        </div>
      )}

      <GlossaryTable
        entries={filtered}
        projectsById={projectsById}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <GlossaryEditDialog
        open={dialogOpen}
        draft={draft}
        projects={projects ?? []}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
    </div>
  )
}
