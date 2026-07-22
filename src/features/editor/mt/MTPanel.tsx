import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Wand2 } from 'lucide-react'
import type { MTProviderId } from '@/core/types'
import { MT_PROVIDERS, type MTErrorCode } from '@/core/mt'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useMTSettings } from './useMTSettings'
import { useMTTranslate } from './useMTTranslate'

interface MTPanelProps {
  focusedSource: string | undefined
  sourceLang: string
  targetLang: string
  onApply: (target: string) => void
}

function errorMessage(code: MTErrorCode, providerLabel: string): string {
  switch (code) {
    case 'auth':
      return `${providerLabel} rejected the API key. Check Settings.`
    case 'rate_limit':
      return `${providerLabel} rate-limited the request. Try again shortly.`
    case 'unsupported_lang':
      return 'This language pair is not supported by the provider.'
    case 'network':
      return 'Network error. Make sure the provider is reachable.'
    case 'offline':
      return 'You are offline — this provider needs the network.'
    case 'parse':
      return 'Could not parse the provider response.'
    case 'aborted':
      return ''
    case 'invalid':
    default:
      return `${providerLabel} could not complete the translation.`
  }
}

export function MTPanel({ focusedSource, sourceLang, targetLang, onApply }: MTPanelProps) {
  const { settings, enabledIds, defaultProvider } = useMTSettings()
  const online = useNetworkStatus()
  const [providerId, setProviderId] = useState<MTProviderId | undefined>(defaultProvider)

  useEffect(() => {
    // Re-resolve when defaults / enabled set changes.
    if (!providerId || !enabledIds.includes(providerId)) {
      setProviderId(defaultProvider)
    }
  }, [defaultProvider, enabledIds, providerId])

  const { result, loading, error, elapsedMs, translate, reset } = useMTTranslate({
    source: focusedSource,
    sourceLang,
    targetLang,
    providerId,
    settings,
  })

  if (enabledIds.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="mt-empty">
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          No MT providers configured.
        </p>
        <Link
          to="/settings"
          className="text-xs underline"
          style={{ color: 'var(--color-accent)' }}
          data-testid="mt-go-settings"
        >
          Open settings to enable MyMemory, Ollama, Claude, or LibreTranslate
        </Link>
      </div>
    )
  }

  const provider = providerId ? MT_PROVIDERS[providerId] : undefined
  const networkBlocked = provider?.requiresNetwork && !online
  const disabledReason = !focusedSource?.trim()
    ? 'Focus a segment first.'
    : networkBlocked
      ? 'Offline — this provider needs the network.'
      : null

  return (
    <div className="flex flex-col gap-2" data-testid="mt-panel-body">
      <div className="flex items-center gap-2">
        <select
          aria-label="MT provider"
          data-testid="mt-provider-select"
          className="h-8 rounded-md border bg-transparent px-2 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={providerId ?? ''}
          onChange={(e) => {
            const id = e.target.value as MTProviderId
            setProviderId(id)
            reset()
          }}
        >
          {enabledIds.map((id) => (
            <option key={id} value={id}>
              {MT_PROVIDERS[id].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void translate()}
          disabled={loading || !!disabledReason}
          data-testid="mt-translate-button"
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-50"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
          }}
        >
          {loading ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
          Translate
        </button>
      </div>

      {disabledReason && !loading && !result && !error && (
        <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="mt-hint">
          {disabledReason}
        </p>
      )}

      {error && error.code !== 'aborted' && (
        <p className="text-xs" style={{ color: '#ef4444' }} data-testid="mt-error">
          {errorMessage(error.code, provider?.label ?? error.providerId)}
        </p>
      )}

      {result && (
        <div
          data-testid="mt-result"
          className="flex flex-col gap-2 rounded-md border p-3 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {provider?.label ?? result.providerId}
              {elapsedMs != null ? ` · ${elapsedMs}ms` : ''}
            </span>
            <button
              type="button"
              onClick={() => onApply(result.text)}
              data-testid="mt-apply"
              className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg)',
              }}
            >
              Apply
            </button>
          </div>
          <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>
            {result.text}
          </div>
        </div>
      )}
    </div>
  )
}
