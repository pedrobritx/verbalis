import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { corpusRepo } from '@/storage/repositories/corpusRepo'
import type { InstalledCorpusPack } from '@/core/corpus/types'
import { useCorpusManifest } from './useCorpusManifest'
import { CorpusPackCard } from './CorpusPackCard'
import { CorpusImportButton } from './CorpusImportButton'
import { CustomCorpusCard } from './CustomCorpusCard'

export default function CorporaPage() {
  const { data: manifest, isLoading, isError, error } = useCorpusManifest()
  const installedPacks = useLiveQuery(() => corpusRepo.getAllPacks(), [])

  const installedById = useMemo(() => {
    const map = new Map<string, InstalledCorpusPack>()
    for (const p of installedPacks ?? []) map.set(p.id, p)
    return map
  }, [installedPacks])

  const installedTermTotal = useMemo(
    () => (installedPacks ?? []).reduce((sum, p) => sum + p.count, 0),
    [installedPacks],
  )

  // Custom (user-uploaded) packs live outside the bundled manifest.
  const customPacks = useMemo(
    () => (installedPacks ?? []).filter((p) => p.id.startsWith('custom:')),
    [installedPacks],
  )

  const subtitle =
    installedPacks === undefined
      ? 'Loading…'
      : installedPacks.length === 0
        ? 'No corpora installed yet'
        : `${installedPacks.length} pack${installedPacks.length === 1 ? '' : 's'} · ${installedTermTotal.toLocaleString()} terms installed`

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <PageHeader title="Corpora" subtitle={subtitle} actions={<CorpusImportButton />} />

      <div
        className="rounded-lg border p-4 text-callout"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <p style={{ color: 'var(--color-text)' }}>
          Pre-curated <strong>Brazilian Portuguese → British English</strong> terminology corpora
          for legal, competition (CADE/antitrust), economic and technical work. Install a field to
          feed its terms into glossary matching and quick lookup; optionally seed your translation
          memory too.
        </p>
        <p className="mt-2" style={{ color: 'var(--color-muted)' }}>
          Installed terms are stored locally and surfaced wherever you translate. See the{' '}
          <Link
            to="/guide"
            className="inline-flex items-center gap-1 underline"
            style={{ color: 'var(--color-accent)' }}
          >
            <BookOpen size={13} /> translation guide
          </Link>{' '}
          for how to apply them.
        </p>
      </div>

      {isLoading && (
        <div
          className="flex items-center gap-2 text-callout"
          style={{ color: 'var(--color-muted)' }}
          data-testid="corpora-loading"
        >
          <Loader2 className="animate-spin" size={16} /> Loading catalogue…
        </div>
      )}

      {isError && (
        <div
          className="flex items-center gap-2 rounded-md border p-3 text-callout"
          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          data-testid="corpora-error"
        >
          <AlertCircle size={16} />
          {error instanceof Error ? error.message : 'Failed to load corpora catalogue.'}
        </div>
      )}

      {customPacks.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="custom-corpora">
          <h2
            className="text-footnote font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            Your corpora
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {customPacks.map((pack) => (
              <CustomCorpusCard key={pack.id} pack={pack} />
            ))}
          </div>
        </div>
      )}

      {manifest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="corpora-grid">
          {manifest.packs.map((pack) => (
            <CorpusPackCard
              key={pack.id}
              pack={pack}
              langSource={manifest.langSource}
              langTarget={manifest.langTarget}
              installed={installedById.get(pack.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
