import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  WEB_SEARCH_SETTINGS_KEY,
  mergeWebSearchSettings,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'
import {
  DEFAULT_WEB_SEARCH_PROVIDERS,
  type WebSearchProvider,
  type WebSearchSettings,
} from '@/core/websearch/providers'

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function WebSearchSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<WebSearchSettings>>(WEB_SEARCH_SETTINGS_KEY),
    [],
  )
  const [providers, setProviders] = useState<WebSearchProvider[]>(DEFAULT_WEB_SEARCH_PROVIDERS)

  useEffect(() => {
    if (stored !== undefined) setProviders(mergeWebSearchSettings(stored ?? undefined).providers)
  }, [stored])

  const save = async (next: WebSearchProvider[]) => {
    setProviders(next)
    await settingsRepo.set(WEB_SEARCH_SETTINGS_KEY, { providers: next })
  }

  const update = (i: number, patch: Partial<WebSearchProvider>) => {
    const next = providers.slice()
    next[i] = { ...next[i], ...patch }
    void save(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        Enabled providers appear in the command palette (⌘/Ctrl+K) and open the focused segment's
        source term in your browser. Verbalis never proxies the query — the request goes straight to
        the provider. Use <code>{'{q}'}</code>, <code>{'{src}'}</code> and <code>{'{tgt}'}</code> in
        the URL template.
      </p>

      <div className="flex flex-col gap-3" data-testid="settings-websearch-providers">
        {providers.map((p, i) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-md border p-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <Input
                aria-label={`Provider name ${i + 1}`}
                value={p.name}
                placeholder="Provider name"
                className="flex-1"
                onChange={(e) => update(i, { name: e.target.value })}
                data-testid={`settings-websearch-name-${i}`}
              />
              <label
                className="flex items-center gap-1.5 text-footnote whitespace-nowrap"
                style={{ color: 'var(--color-text)' }}
              >
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                  data-testid={`settings-websearch-enabled-${i}`}
                />
                Enabled
              </label>
              <Button
                variant="plain"
                size="sm"
                aria-label={`Remove provider ${i + 1}`}
                onClick={() => void save(providers.filter((_, j) => j !== i))}
                data-testid={`settings-websearch-remove-${i}`}
              >
                ✕
              </Button>
            </div>
            <Input
              aria-label={`Provider URL ${i + 1}`}
              value={p.urlTemplate}
              placeholder="https://example.com/search?query={q}"
              onChange={(e) => update(i, { urlTemplate: e.target.value })}
              data-testid={`settings-websearch-url-${i}`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="bordered"
          size="sm"
          onClick={() =>
            void save([...providers, { id: uid(), name: '', urlTemplate: '', enabled: true }])
          }
          data-testid="settings-websearch-add"
        >
          Add provider
        </Button>
        <Button
          variant="plain"
          size="sm"
          onClick={() => void save(DEFAULT_WEB_SEARCH_PROVIDERS)}
          data-testid="settings-websearch-reset"
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}
