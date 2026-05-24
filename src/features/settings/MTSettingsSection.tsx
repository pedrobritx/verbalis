import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MTProviderId, MTSettings } from '@/core/types'
import { MT_PROVIDERS } from '@/core/mt'
import {
  DEFAULT_MT_SETTINGS,
  MT_SETTINGS_KEY,
  mergeMTSettings,
  settingsRepo,
} from '@/storage/repositories/settingsRepo'
import { useLiveQuery } from 'dexie-react-hooks'

type TestState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

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

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 py-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function SecretInput({
  id,
  value,
  onChange,
  testId,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  testId?: string
  placeholder?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="text-xs p-1.5 rounded transition-colors hover:opacity-70"
        style={{ color: 'var(--color-muted)' }}
        aria-label={shown ? 'Hide key' : 'Show key'}
      >
        {shown ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs"
          style={{ color: 'var(--color-muted)' }}
        >
          Clear
        </button>
      )}
    </div>
  )
}

interface ProviderCardProps {
  id: MTProviderId
  settings: MTSettings
  onPatch: (patch: Partial<MTSettings>) => void
}

function ProviderCard({ id, settings, onPatch }: ProviderCardProps) {
  const provider = MT_PROVIDERS[id]
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const isDefault = settings.default === id
  const enabled =
    id === 'ollama'
      ? settings.ollama.enabled
      : id === 'claude'
        ? settings.claude.enabled
        : settings.libretranslate.enabled

  async function runTest() {
    setTest({ status: 'pending' })
    try {
      const fn = provider.testConnection
      if (!fn) {
        setTest({ status: 'idle' })
        return
      }
      if (id === 'ollama') await fn(settings.ollama)
      else if (id === 'claude') await fn(settings.claude)
      else await fn(settings.libretranslate)
      setTest({ status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed'
      setTest({ status: 'error', message: msg })
    }
  }

  return (
    <div
      className="rounded-md border p-3 flex flex-col gap-2"
      style={{ borderColor: 'var(--color-border)' }}
      data-testid={`mt-card-${id}`}
    >
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const checked = e.target.checked
              if (id === 'ollama') onPatch({ ollama: { ...settings.ollama, enabled: checked } })
              else if (id === 'claude')
                onPatch({ claude: { ...settings.claude, enabled: checked } })
              else
                onPatch({
                  libretranslate: { ...settings.libretranslate, enabled: checked },
                })
            }}
            data-testid={`mt-${id}-enabled`}
          />
          <span className="font-semibold">{provider.label}</span>
        </label>
        <label
          className="text-xs flex items-center gap-1.5"
          style={{ color: 'var(--color-muted)' }}
        >
          <input
            type="radio"
            name="mt-default"
            checked={isDefault}
            disabled={!enabled}
            onChange={() => onPatch({ default: id })}
            data-testid={`mt-${id}-default`}
          />
          default
        </label>
      </div>

      {id === 'ollama' && (
        <>
          <FieldRow label="Endpoint" htmlFor="ollama-endpoint">
            <Input
              id="ollama-endpoint"
              value={settings.ollama.endpoint}
              onChange={(e) =>
                onPatch({ ollama: { ...settings.ollama, endpoint: e.target.value } })
              }
              data-testid="mt-ollama-endpoint"
            />
          </FieldRow>
          <FieldRow label="Model" htmlFor="ollama-model">
            <Input
              id="ollama-model"
              value={settings.ollama.model}
              onChange={(e) =>
                onPatch({ ollama: { ...settings.ollama, model: e.target.value } })
              }
              data-testid="mt-ollama-model"
            />
          </FieldRow>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Ollama must be running locally and configured to accept this origin
            (<code>OLLAMA_ORIGINS=*</code>).
          </p>
        </>
      )}

      {id === 'claude' && (
        <>
          <FieldRow label="API key" htmlFor="claude-key">
            <SecretInput
              id="claude-key"
              value={settings.claude.apiKey}
              onChange={(v) => onPatch({ claude: { ...settings.claude, apiKey: v } })}
              placeholder="sk-ant-…"
              testId="mt-claude-key"
            />
          </FieldRow>
          <FieldRow label="Model" htmlFor="claude-model">
            <Input
              id="claude-model"
              value={settings.claude.model}
              onChange={(e) =>
                onPatch({ claude: { ...settings.claude, model: e.target.value } })
              }
              data-testid="mt-claude-model"
            />
          </FieldRow>
          <p
            className="text-xs rounded border p-2"
            style={{
              color: 'var(--color-muted)',
              borderColor: 'var(--color-border)',
              background: 'rgba(234, 179, 8, 0.08)',
            }}
          >
            Your API key is stored unencrypted in this browser's IndexedDB. Anyone with
            access to this browser profile can read it.
          </p>
        </>
      )}

      {id === 'libretranslate' && (
        <>
          <FieldRow label="Endpoint" htmlFor="libre-endpoint">
            <Input
              id="libre-endpoint"
              value={settings.libretranslate.endpoint}
              onChange={(e) =>
                onPatch({
                  libretranslate: { ...settings.libretranslate, endpoint: e.target.value },
                })
              }
              data-testid="mt-libre-endpoint"
            />
          </FieldRow>
          <FieldRow label="API key (optional)" htmlFor="libre-key">
            <SecretInput
              id="libre-key"
              value={settings.libretranslate.apiKey ?? ''}
              onChange={(v) =>
                onPatch({ libretranslate: { ...settings.libretranslate, apiKey: v } })
              }
              testId="mt-libre-key"
            />
          </FieldRow>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={!enabled || test.status === 'pending'}
          className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          data-testid={`mt-${id}-test`}
        >
          {test.status === 'pending' ? 'Testing…' : 'Test connection'}
        </button>
        {test.status === 'ok' && (
          <span className="text-xs" style={{ color: '#22c55e' }}>
            ✓ ok
          </span>
        )}
        {test.status === 'error' && (
          <span className="text-xs" style={{ color: '#ef4444' }} title={test.message}>
            ✗ {test.message.slice(0, 40)}
          </span>
        )}
      </div>
    </div>
  )
}

export function MTSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<MTSettings>>(MT_SETTINGS_KEY),
    [],
  )
  const merged = useMemo(() => mergeMTSettings(stored), [stored])
  const [draft, setDraft] = useState<MTSettings>(merged)
  const lastStoredRef = useRef<string>(JSON.stringify(merged))

  // Sync down when the persisted store changes externally.
  useEffect(() => {
    const next = JSON.stringify(merged)
    if (next !== lastStoredRef.current) {
      lastStoredRef.current = next
      setDraft(merged)
    }
  }, [merged])

  function patch(p: Partial<MTSettings>) {
    setDraft((prev) => {
      const next: MTSettings = { ...prev, ...p }
      // If the new default isn't enabled, drop it.
      if (next.default) {
        const enabled =
          (next.default === 'ollama' && next.ollama.enabled) ||
          (next.default === 'claude' && next.claude.enabled) ||
          (next.default === 'libretranslate' && next.libretranslate.enabled)
        if (!enabled) next.default = undefined
      }
      lastStoredRef.current = JSON.stringify(next)
      void settingsRepo.set(MT_SETTINGS_KEY, next)
      return next
    })
  }

  return (
    <Section title="Machine translation">
      <div className="flex flex-col gap-3">
        <ProviderCard id="ollama" settings={draft} onPatch={patch} />
        <ProviderCard id="claude" settings={draft} onPatch={patch} />
        <ProviderCard id="libretranslate" settings={draft} onPatch={patch} />
        <button
          type="button"
          onClick={() => {
            void settingsRepo.set(MT_SETTINGS_KEY, DEFAULT_MT_SETTINGS)
            setDraft(DEFAULT_MT_SETTINGS)
          }}
          className="self-end text-xs"
          style={{ color: 'var(--color-muted)' }}
          data-testid="mt-reset"
        >
          Reset to defaults
        </button>
      </div>
    </Section>
  )
}
