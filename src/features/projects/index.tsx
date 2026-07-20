import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FilePlus, FileText, Upload, PencilLine, Download, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { BrandFooter } from '@/components/layout/BrandFooter'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import { ImportDialog } from '@/features/import/ImportDialog'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'
import { ProjectCard } from './ProjectCard'
import { OpenFromCloudButton } from './cloud/CloudControls'
import { OpenCloudProjectDialog } from './cloud/OpenCloudProjectDialog'

type SortKey = 'updated' | 'name'

export default function ProjectsPage() {
  const [importOpen, setImportOpen] = useState(false)
  const [cloudOpen, setCloudOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const openShortcuts = useShortcutsStore((s) => s.setOpen)
  const projects = useLiveQuery(() => projectRepo.getAll(), [])
  // One index-only query yields every project's status counts, instead of each
  // card scanning its segments independently.
  const counts = useLiveQuery(() => segmentRepo.countByStatusAll(), [])

  const visible = useMemo(() => {
    if (!projects) return []
    const q = query.trim().toLowerCase()
    const rows = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : [...projects]
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    // 'updated' order already comes from the repo (updatedAt desc).
    return rows
  }, [projects, query, sort])

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader
        title="Projects"
        subtitle={
          projects === undefined
            ? 'Loading…'
            : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
        }
        actions={
          <div className="flex items-center gap-2">
            <OpenFromCloudButton onClick={() => setCloudOpen(true)} />
            <Button onClick={() => setImportOpen(true)}>
              <FilePlus />
              Import file
            </Button>
          </div>
        }
      />

      {projects === undefined ? null : projects.length === 0 ? (
        <FirstRunOnboarding
          onImport={() => setImportOpen(true)}
          onShortcuts={() => openShortcuts(true)}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="project-search"
              className="sm:flex-1"
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              data-testid="project-sort"
              className="sm:w-48"
              aria-label="Sort projects"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name (A–Z)</option>
            </Select>
          </div>

          {visible.length === 0 ? (
            <p className="text-callout" style={{ color: 'var(--color-muted)' }} data-testid="project-empty-search">
              No projects match “{query}”.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="project-list">
              {visible.map((p) => (
                <ProjectCard key={p.id} project={p} counts={counts?.get(p.id)} />
              ))}
            </ul>
          )}
        </>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <OpenCloudProjectDialog open={cloudOpen} onOpenChange={setCloudOpen} />

      <BrandFooter />
    </div>
  )
}

interface FirstRunOnboardingProps {
  onImport: () => void
  onShortcuts: () => void
}

function FirstRunOnboarding({ onImport, onShortcuts }: FirstRunOnboardingProps) {
  return (
    <div
      className="rounded-lg border p-6 sm:p-8 flex flex-col gap-6"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      data-testid="first-run-onboarding"
    >
      <div className="flex items-start gap-3">
        <FileText size={28} style={{ color: 'var(--color-accent)' }} />
        <div className="flex flex-col gap-1">
          <h2
            className="text-title-3 font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Welcome to Verbalis
          </h2>
          <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
            A local-first CAT tool. Your files, translations, and memory stay in
            this browser — nothing is uploaded.
          </p>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        <Step
          icon={<Upload size={18} />}
          number={1}
          title="Import"
          body="TXT, MD, DOCX or XLIFF (memoQ / OmegaT). Pick a source and target language (including regional variants like pt-BR or en-GB)."
        />
        <Step
          icon={<PencilLine size={18} />}
          number={2}
          title="Translate"
          body="Confirm segments with Ctrl + Enter. TM, glossary and MT suggestions sit in the right-hand panel."
        />
        <Step
          icon={<Download size={18} />}
          number={3}
          title="Re-use"
          body="Translation memory and glossary build up as you work and can be exported as TMX, CSV or TBX."
        />
      </ol>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button onClick={onImport} data-testid="onboarding-import">
          <FilePlus />
          Import your first file
        </Button>
        <Button
          variant="plain"
          onClick={onShortcuts}
          data-testid="onboarding-shortcuts"
        >
          <Keyboard />
          Keyboard shortcuts
        </Button>
      </div>
    </div>
  )
}

function Step({
  icon,
  number,
  title,
  body,
}: {
  icon: React.ReactNode
  number: number
  title: string
  body: string
}) {
  return (
    <li
      className="flex flex-col gap-2 rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold tabular-nums"
          style={{
            background: 'var(--color-accent-fill)',
            color: 'var(--color-accent)',
          }}
          aria-hidden
        >
          {number}
        </span>
        <span style={{ color: 'var(--color-muted)' }} aria-hidden>
          {icon}
        </span>
        <h3
          className="text-callout font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h3>
      </div>
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        {body}
      </p>
    </li>
  )
}
