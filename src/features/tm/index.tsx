import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Fuse from 'fuse.js'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { projectRepo } from '@/storage/repositories/projectRepo'
import type { TMEntry, Project } from '@/core/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { TMImportButton } from './TMImportButton'
import { TMExportButton } from './TMExportButton'
import { TMTable } from './TMTable'

const ALL_LANGS = '__all__'
const ALL_PROJECTS = '__all__'
const UNASSIGNED = '__unassigned__'

export default function TMPage() {
  const entries = useLiveQuery(() => tmRepo.getAll(), [])
  const projects = useLiveQuery(() => projectRepo.getAll(), [])
  const [query, setQuery] = useState('')
  const [langPair, setLangPair] = useState<string>(ALL_LANGS)
  const [projectFilter, setProjectFilter] = useState<string>(ALL_PROJECTS)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>()
    if (projects) for (const p of projects) map.set(p.id, p)
    return map
  }, [projects])

  const langPairs = useMemo(() => {
    if (!entries) return []
    const set = new Set<string>()
    for (const e of entries) set.add(`${e.sourceLang}|${e.targetLang}`)
    return Array.from(set).sort()
  }, [entries])

  const filtered = useMemo<TMEntry[]>(() => {
    if (!entries) return []
    let rows: TMEntry[] = entries
    if (langPair !== ALL_LANGS) {
      const [sl, tl] = langPair.split('|')
      rows = rows.filter((e) => e.sourceLang === sl && e.targetLang === tl)
    }
    if (projectFilter !== ALL_PROJECTS) {
      if (projectFilter === UNASSIGNED) rows = rows.filter((e) => !e.projectId)
      else rows = rows.filter((e) => e.projectId === projectFilter)
    }
    if (query.trim()) {
      const fuse = new Fuse(rows, {
        keys: ['source', 'target'],
        threshold: 0.4,
        ignoreLocation: true,
      })
      rows = fuse.search(query).map((r) => r.item)
    } else {
      rows = [...rows].sort((a, b) => b.date.localeCompare(a.date))
    }
    return rows
  }, [entries, query, langPair, projectFilter])

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
    await tmRepo.remove(id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    await tmRepo.removeMany(Array.from(selected))
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <PageHeader
        title="Translation Memory"
        subtitle={
          entries === undefined
            ? 'Loading…'
            : `${entries.length} total ${entries.length === 1 ? 'entry' : 'entries'}`
        }
        actions={
          <>
            <TMImportButton />
            <TMExportButton entries={filtered} />
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <Input
          placeholder="Search source or target…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="tm-search-input"
        />
        <Select
          value={langPair}
          onChange={(e) => setLangPair(e.target.value)}
          data-testid="tm-lang-filter"
        >
          <option value={ALL_LANGS}>All languages</option>
          {langPairs.map((p) => {
            const [sl, tl] = p.split('|')
            return (
              <option key={p} value={p}>
                {sl} → {tl}
              </option>
            )
          })}
        </Select>
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          data-testid="tm-project-filter"
        >
          <option value={ALL_PROJECTS}>All projects</option>
          <option value={UNASSIGNED}>Unassigned</option>
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
            data-testid="tm-bulk-delete"
          >
            <Trash2 />
            Delete selected
          </Button>
        </div>
      )}

      <TMTable
        entries={filtered}
        projectsById={projectsById}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onDelete={handleDelete}
      />
    </div>
  )
}
