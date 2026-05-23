import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FilePlus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { projectRepo } from '@/storage/repositories/projectRepo'
import { ImportDialog } from '@/features/import/ImportDialog'

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
  const projects = useLiveQuery(() => projectRepo.getAll(), [])

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Projects
        </h1>
        <Button onClick={() => setImportOpen(true)}>
          <FilePlus />
          Import file
        </Button>
      </div>

      {projects === undefined ? null : projects.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-10 text-center"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <FileText className="mx-auto mb-3 opacity-60" size={32} />
          <p className="text-sm">No projects yet. Import a TXT or MD file to start.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="project-list">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/project/${p.id}`}
                className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {p.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
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
    </div>
  )
}
