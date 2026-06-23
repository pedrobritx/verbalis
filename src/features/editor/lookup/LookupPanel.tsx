import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink } from 'lucide-react'
import { TranslateWorkspace } from '@/features/translate/TranslateWorkspace'
import { buildSearchUrl } from '@/core/websearch/providers'
import { getWebSearchSettings } from '@/storage/repositories/settingsRepo'
import { useEditorSelectionStore } from '../useEditorSelectionStore'

interface LookupPanelProps {
  sourceLang: string
  targetLang: string
  projectId: string
}

/**
 * In-editor lookup surface. Reuses the Quick-lookup `TranslateWorkspace`
 * (Wiktionary definition + MT + save-to-TM/glossary) seeded with whatever the
 * translator last selected in a segment, and adds a row of one-click web-search
 * launchers for the providers they've enabled in Settings.
 */
export function LookupPanel({ sourceLang, targetLang }: LookupPanelProps) {
  const selection = useEditorSelectionStore((s) => s.text)
  const webSearch = useLiveQuery(() => getWebSearchSettings(), [])
  const enabledProviders = webSearch?.providers.filter((p) => p.enabled) ?? []

  return (
    <div className="flex flex-col gap-3" data-testid="lookup-panel-body">
      {!selection && (
        <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="lookup-hint">
          Select a word or phrase in a segment to look it up — or type below.
        </p>
      )}

      <TranslateWorkspace
        active
        prefill={selection}
        autoFocus={false}
        testIdPrefix="lookup"
      />

      {enabledProviders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            Web search
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enabledProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!selection}
                data-testid={`lookup-websearch-${provider.id}`}
                onClick={() =>
                  window.open(
                    buildSearchUrl(provider, { q: selection, src: sourceLang, tgt: targetLang }),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:bg-[var(--color-fill)] disabled:opacity-40 disabled:pointer-events-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <ExternalLink size={12} />
                {provider.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
