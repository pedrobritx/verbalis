import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FilePlus,
  Upload,
  PencilLine,
  Download,
  Keyboard,
  ShieldCheck,
  WifiOff,
  FileCode2,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { VerbalisMark } from '@/components/brand/VerbalisMark'
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

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Private by architecture',
    body: 'Files, translation memory and glossaries live in this browser (IndexedDB). Nothing is uploaded — privacy is the default, not a toggle.',
  },
  {
    icon: WifiOff,
    title: 'Works offline',
    body: 'Installable as a PWA that runs with no connection. Spell-check, dictionaries and TM all run on-device.',
  },
  {
    icon: FileCode2,
    title: 'Industry formats',
    body: 'Round-trips XLIFF 1.2, TMX, TBX, DOCX and OmegaT, so it slots into the same pipelines as memoQ, Trados and OmegaT.',
  },
  {
    icon: Sparkles,
    title: 'Smart assist',
    body: 'Translation memory, glossary matching, bundled PT→EN corpora and optional on-device semantic search reuse your past work.',
  },
] as const

const STEPS = [
  {
    icon: Upload,
    title: 'Import',
    body: 'TXT, MD, DOCX or XLIFF (memoQ / OmegaT). Pick a source and target language — regional variants like pt-BR or en-GB included.',
  },
  {
    icon: PencilLine,
    title: 'Translate',
    body: 'Confirm segments with Ctrl + Enter. TM, glossary and MT suggestions sit in the right-hand panel.',
  },
  {
    icon: Download,
    title: 'Re-use',
    body: 'Translation memory and glossary build up as you work and export as TMX, CSV or TBX.',
  },
] as const

function FirstRunOnboarding({ onImport, onShortcuts }: FirstRunOnboardingProps) {
  return (
    <div className="flex flex-col gap-6" data-testid="first-run-onboarding">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-lg border p-6 sm:p-10"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex flex-col items-start gap-5 max-w-2xl">
          <VerbalisMark size={44} withTile />
          <div className="flex flex-col gap-3">
            <h1
              className="text-title-1 font-semibold tracking-tight"
              style={{ color: 'var(--color-text)' }}
            >
              A CAT tool for translators who keep secrets.
            </h1>
            <p className="text-body" style={{ color: 'var(--color-muted)' }}>
              Verbalis is a <strong style={{ color: 'var(--color-text)' }}>local-first</strong>{' '}
              computer-assisted translation workspace. Import your files, translate with memory
              and glossary support, and export clean — all without a single sentence leaving your
              machine.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={onImport} data-testid="onboarding-import">
              <FilePlus />
              Import your first file
            </Button>
            <Button variant="plain" asChild>
              <Link to="/guide" data-testid="onboarding-guide">
                <BookOpen />
                Read the guide
              </Link>
            </Button>
            <Button variant="plain" onClick={onShortcuts} data-testid="onboarding-shortcuts">
              <Keyboard />
              Keyboard shortcuts
            </Button>
          </div>
          <p className="text-footnote" style={{ color: 'var(--color-subtle)' }}>
            No sign-up required. Works fully offline.
          </p>
        </div>
      </div>

      {/* Value props */}
      <div className="grid gap-3 sm:grid-cols-2">
        {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex gap-3 rounded-md border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              style={{ background: 'var(--color-accent-fill)', color: 'var(--color-accent)' }}
              aria-hidden
            >
              <Icon size={18} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-callout font-semibold" style={{ color: 'var(--color-text)' }}>
                {title}
              </h3>
              <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="flex flex-col gap-3">
        <h2 className="text-subhead font-semibold" style={{ color: 'var(--color-muted)' }}>
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon, title, body }, i) => (
            <Step key={title} icon={icon} number={i + 1} title={title} body={body} />
          ))}
        </ol>
      </div>
    </div>
  )
}

function Step({
  icon: Icon,
  number,
  title,
  body,
}: {
  icon: typeof Upload
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
          <Icon size={18} />
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
