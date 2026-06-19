import { useState } from 'react'
import { Check, Download, Loader2, Trash2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchCorpusPack } from '@/core/corpus/manifest'
import { corpusRepo } from '@/storage/repositories/corpusRepo'
import type { CorpusPackMeta, InstalledCorpusPack } from '@/core/corpus/types'

interface CorpusPackCardProps {
  pack: CorpusPackMeta
  langSource: string
  langTarget: string
  installed?: InstalledCorpusPack
}

function sourcesLabel(sources: Record<string, number>): string {
  return Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .join(' · ')
}

export function CorpusPackCard({
  pack,
  langSource,
  langTarget,
  installed,
}: CorpusPackCardProps) {
  const [busy, setBusy] = useState(false)
  const [seedTm, setSeedTm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isInstalled = Boolean(installed)

  async function handleInstall() {
    setBusy(true)
    setError(null)
    try {
      const file = await fetchCorpusPack(pack.file)
      await corpusRepo.install(file, { label: pack.label }, { seedTm })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleUninstall() {
    setBusy(true)
    setError(null)
    try {
      await corpusRepo.uninstall(pack.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{
        borderColor: isInstalled ? 'var(--color-accent)' : 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
      data-testid={`corpus-pack-${pack.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-body font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {pack.label}
            </h3>
            {isInstalled && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                style={{
                  background: 'var(--color-accent-fill)',
                  color: 'var(--color-accent)',
                }}
                data-testid={`corpus-installed-${pack.id}`}
              >
                <Check size={12} /> Installed
              </span>
            )}
          </div>
          <p className="mt-1 text-footnote" style={{ color: 'var(--color-muted)' }}>
            {pack.description}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-mono"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          {langSource} → {langTarget}
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        <span className="inline-flex items-center gap-1">
          <Database size={12} />
          {pack.count.toLocaleString()} terms
        </span>
        <span>Source: {sourcesLabel(pack.sources)}</span>
        {installed?.tmSeeded && <span style={{ color: 'var(--color-accent)' }}>TM seeded</span>}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {isInstalled ? (
          <Button
            variant="bordered"
            size="sm"
            onClick={handleUninstall}
            disabled={busy}
            data-testid={`corpus-uninstall-${pack.id}`}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Remove
          </Button>
        ) : (
          <>
            <label
              className="flex items-center gap-2 text-footnote select-none"
              style={{ color: 'var(--color-muted)' }}
            >
              <input
                type="checkbox"
                checked={seedTm}
                onChange={(e) => setSeedTm(e.target.checked)}
                disabled={busy}
                data-testid={`corpus-seedtm-${pack.id}`}
              />
              Also add to TM
            </label>
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={busy}
              data-testid={`corpus-install-${pack.id}`}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              Install
            </Button>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
