import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FilePlus, FileText, Upload, PencilLine, Download, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { BrandFooter } from '@/components/layout/BrandFooter'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { ImportDialog } from '@/features/import/ImportDialog'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function ProjectsPage() {
  const [importOpen, setImportOpen] = useState(false)
  const openShortcuts = useShortcutsStore((s) => s.setOpen)
  const projects = useLiveQuery(() => projectRepo.getAll(), [])

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
          <Button onClick={() => setImportOpen(true)}>
            <FilePlus />
            Import file
          </Button>
        }
      />

      {projects === undefined ? null : projects.length === 0 ? (
        <FirstRunOnboarding
          onImport={() => setImportOpen(true)}
          onShortcuts={() => openShortcuts(true)}
        />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="project-list">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/project/${p.id}`}
                className="flex items-center justify-between rounded-md border px-4 py-3 min-h-hit transition-colors hover:bg-[var(--color-fill)]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-callout font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {p.name}
                  </span>
                  <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
                    Updated {formatRelative(p.updatedAt)}
                  </span>
                </div>
                <Badge variant="outline" style={{ color: 'var(--color-muted)' }}>
                  {p.sourceLang} → {p.targetLang}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

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
