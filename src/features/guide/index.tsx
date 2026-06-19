import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, Library } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Markdown } from './Markdown'

interface GuideDoc {
  id: string
  label: string
  file: string
}

const DOCS: GuideDoc[] = [
  { id: 'workflow', label: 'Workflow & theory', file: 'workflow.md' },
  { id: 'standards', label: 'Standards & conventions', file: 'standards.md' },
  { id: 'theory', label: 'Translation-theory glossary', file: 'theory-glossary.md' },
]

function guideUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/$/, '')}/guide/${file}`
}

function useGuideDoc(file: string) {
  return useQuery<string>({
    queryKey: ['guide-doc', file],
    queryFn: async ({ signal }) => {
      const res = await fetch(guideUrl(file), { signal })
      if (!res.ok) throw new Error(`Failed to load guide (${res.status})`)
      return res.text()
    },
    staleTime: Infinity,
  })
}

export default function GuidePage() {
  const [active, setActive] = useState<GuideDoc>(DOCS[0])
  const { data, isLoading, isError, error } = useGuideDoc(active.file)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <PageHeader
        title="Translation guide"
        subtitle="PT↔EN legal, economic & technical translation reference"
      />

      <div
        className="rounded-lg border p-4 text-callout"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <p style={{ color: 'var(--color-text)' }}>
          Reference material for Brazilian Portuguese ↔ British English work: the translate /
          revise workflow, British-English &amp; ABNT/NBR conventions, and translation-theory
          definitions.
        </p>
        <p className="mt-2" style={{ color: 'var(--color-muted)' }}>
          Where the source workflow refers to a terminology lookup, use the installed{' '}
          <Link
            to="/corpora"
            className="inline-flex items-center gap-1 underline"
            style={{ color: 'var(--color-accent)' }}
          >
            <Library size={13} /> corpora
          </Link>{' '}
          and your glossary in the editor.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Guide sections"
        className="flex flex-wrap items-center gap-1 rounded-md border p-1"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {DOCS.map((doc) => {
          const isActive = active.id === doc.id
          return (
            <button
              key={doc.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(doc)}
              data-testid={`guide-tab-${doc.id}`}
              className={cn(
                'text-footnote px-3 py-1.5 rounded transition-colors',
                isActive ? 'font-semibold' : 'hover:opacity-80',
              )}
              style={{
                background: isActive ? 'var(--color-surface)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
              }}
            >
              {doc.label}
            </button>
          )
        })}
      </div>

      <div
        className="rounded-lg border p-5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {isLoading && (
          <div
            className="flex items-center gap-2 text-callout"
            style={{ color: 'var(--color-muted)' }}
          >
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        )}
        {isError && (
          <div
            className="flex items-center gap-2 text-callout"
            style={{ color: 'var(--color-error)' }}
          >
            <AlertCircle size={16} />
            {error instanceof Error ? error.message : 'Failed to load guide.'}
          </div>
        )}
        {data && <Markdown content={data} />}
      </div>
    </div>
  )
}
