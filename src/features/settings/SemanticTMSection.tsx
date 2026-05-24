import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { SemanticTMSettings } from '@/core/types'
import {
  SEMANTIC_TM_KEY,
  mergeSemanticTMSettings,
  settingsRepo,
  DEFAULT_SEMANTIC_TM,
} from '@/storage/repositories/settingsRepo'
import { embeddingsRepo } from '@/storage/repositories/embeddingsRepo'
import { useSemanticIndexBuilder } from './useSemanticIndexBuilder'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function SemanticTMSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<SemanticTMSettings>>(SEMANTIC_TM_KEY),
    [],
  )
  const [draft, setDraft] = useState<SemanticTMSettings>(DEFAULT_SEMANTIC_TM)
  useEffect(() => {
    setDraft(mergeSemanticTMSettings(stored))
  }, [stored])

  const count = useLiveQuery(() => embeddingsRepo.count(draft.model), [draft.model]) ?? 0
  const { state, build } = useSemanticIndexBuilder(draft.model)

  function persist(next: SemanticTMSettings) {
    setDraft(next)
    void settingsRepo.set(SEMANTIC_TM_KEY, next)
  }

  return (
    <Section title="Semantic translation memory">
      <div className="flex flex-col gap-3">
        <label
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-text)' }}
        >
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => persist({ ...draft, enabled: e.target.checked })}
            data-testid="semantic-enabled"
          />
          Enable semantic matches in TM panel
        </label>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          The first time you enable this and run a search, a ~50&nbsp;MB model is
          downloaded and cached in your browser. Everything runs locally after that.
        </p>

        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Model
          </span>
          <code
            className="text-xs px-2 py-1 rounded"
            style={{
              color: 'var(--color-text)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}
            data-testid="semantic-model"
          >
            {draft.model}
          </code>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="semantic-threshold"
            className="text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            Similarity threshold: {draft.threshold.toFixed(2)}
          </label>
          <input
            id="semantic-threshold"
            type="range"
            min={0.6}
            max={0.9}
            step={0.01}
            value={draft.threshold}
            onChange={(e) => persist({ ...draft, threshold: parseFloat(e.target.value) })}
            data-testid="semantic-threshold"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span
            className="text-xs"
            style={{ color: 'var(--color-muted)' }}
            data-testid="semantic-count"
          >
            {count} embedded TM {count === 1 ? 'entry' : 'entries'}
          </span>
          <button
            type="button"
            onClick={() => void build()}
            disabled={state.building}
            className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            data-testid="semantic-build"
          >
            {state.building
              ? `Building ${state.done}/${state.total}…`
              : count > 0
                ? 'Rebuild index'
                : 'Build index'}
          </button>
        </div>

        {state.error && (
          <p className="text-xs" style={{ color: '#ef4444' }} data-testid="semantic-error">
            {state.error}
          </p>
        )}
      </div>
    </Section>
  )
}
