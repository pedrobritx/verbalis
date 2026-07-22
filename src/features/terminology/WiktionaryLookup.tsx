import { useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  fetchWiktionaryEntry,
  WiktionaryError,
  type WiktionaryResult,
} from '@/core/glossary/wiktionary'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { LANG_OPTIONS } from '@/core/lang/options'
import type { GlossaryEditDraft } from './GlossaryEditDialog'

const OFFLINE_MESSAGE = "You're offline — only previously looked-up terms are available."

interface WiktionaryLookupProps {
  onAddToGlossary: (draft: GlossaryEditDraft) => void
}

export function WiktionaryLookup({ onAddToGlossary }: WiktionaryLookupProps) {
  const [term, setTerm] = useState('')
  const [lang, setLang] = useState('en')
  const [result, setResult] = useState<WiktionaryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const online = useNetworkStatus()
  // In-memory cache keyed by `${lang}:${term-lowercase}`.
  const cacheRef = useRef<Map<string, WiktionaryResult>>(new Map())

  const trimmed = term.trim()
  const cacheKey = `${lang}:${trimmed.toLowerCase()}`
  const hasCacheHit = trimmed ? cacheRef.current.has(cacheKey) : false
  const lookupDisabled = loading || !trimmed || (!online && !hasCacheHit)

  async function handleLookup() {
    if (!trimmed) return
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResult(cached)
      setError(null)
      return
    }
    if (!online) {
      setError(OFFLINE_MESSAGE)
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetchWiktionaryEntry(trimmed, lang)
      cacheRef.current.set(cacheKey, res)
      setResult(res)
    } catch (err) {
      if (err instanceof WiktionaryError) {
        if (err.code === 'network' && typeof navigator !== 'undefined' && !navigator.onLine) {
          setError(OFFLINE_MESSAGE)
        } else {
          setError(
            err.code === 'not_found'
              ? `"${trimmed}" not found on ${lang}.wiktionary.org`
              : err.message,
          )
        }
      } else {
        setError(err instanceof Error ? err.message : 'Lookup failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleAdd() {
    if (!result) return
    const primaryDef = result.definitions[0]?.definition ?? ''
    onAddToGlossary({
      term: result.term,
      definition: primaryDef,
      translations: Object.entries(result.translations).map(([l, value]) => ({
        lang: l,
        value,
      })),
      notes: '',
    })
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border p-5"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
      data-testid="wiktionary-section"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-headline font-semibold" style={{ color: 'var(--color-text)' }}>
          Wiktionary lookup
        </h2>
        <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
          en.wiktionary.org REST API
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_8rem_auto] gap-2">
        <Input
          placeholder="Term to look up…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleLookup()
          }}
          data-testid="wiktionary-term-input"
        />
        <Select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          data-testid="wiktionary-lang-select"
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          onClick={handleLookup}
          disabled={lookupDisabled}
          data-testid="wiktionary-lookup-button"
        >
          <Search />
          {loading ? 'Looking up…' : 'Look up'}
        </Button>
      </div>

      {error && (
        <p
          className="text-footnote"
          style={{ color: 'var(--color-error)' }}
          data-testid="wiktionary-error"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3" data-testid="wiktionary-result">
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {result.term}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-muted)' }}>
                ({result.sourceLang})
              </span>
            </span>
            <Button
              variant="bordered"
              size="sm"
              onClick={handleAdd}
              data-testid="wiktionary-add-button"
            >
              Add to glossary
            </Button>
          </div>

          {result.definitions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              No definitions returned.
            </p>
          ) : (
            <ol className="flex flex-col gap-2 list-decimal list-inside text-sm">
              {result.definitions.slice(0, 6).map((d, i) => (
                <li key={i} style={{ color: 'var(--color-text)' }}>
                  <span className="text-xs italic mr-1" style={{ color: 'var(--color-muted)' }}>
                    {d.partOfSpeech}
                  </span>
                  {d.definition}
                </li>
              ))}
            </ol>
          )}

          {Object.keys(result.translations).length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Translations
              </span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(result.translations)
                  .slice(0, 20)
                  .map(([l, value]) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                      style={{
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <span style={{ color: 'var(--color-muted)' }}>{l}</span>
                      <span>{value}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
