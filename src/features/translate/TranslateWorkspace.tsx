import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardPaste, Copy, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LANG_OPTIONS, getLanguageLabel } from '@/core/lang/options'
import { detectLanguage } from '@/core/lang/detect'
import {
  fetchWiktionaryEntry,
  WiktionaryError,
  type WiktionaryResult,
} from '@/core/glossary/wiktionary'
import { translateWith, resolveDefaultProvider, MTError } from '@/core/mt'
import {
  getLookupSettings,
  getMTSettings,
  settingsRepo,
  LOOKUP_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'
import { tmRepo } from '@/storage/repositories/tmRepo'
import { glossaryRepo } from '@/storage/repositories/glossaryRepo'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { GlossaryEntry, LookupSettings, MTSettings } from '@/core/types'

// Wiktionary only has entries for single words and a handful of fixed
// expressions, so don't try to look up longer phrases — they always fail.
const SHORT_INPUT_MAX_WORDS = 2

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface TranslateWorkspaceProps {
  active: boolean
  prefill?: string
  autoFocus?: boolean
  testIdPrefix?: string
}

export function TranslateWorkspace({
  active,
  prefill = '',
  autoFocus = true,
  testIdPrefix = 'quick-lookup',
}: TranslateWorkspaceProps) {
  const online = useNetworkStatus()

  const [input, setInput] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('en')
  const [detected, setDetected] = useState<string>('und')
  const [mtSettings, setMtSettings] = useState<MTSettings | null>(null)
  const [lookupSettings, setLookupSettings] = useState<LookupSettings | null>(null)
  const [mtResult, setMtResult] = useState<string>('')
  const [mtError, setMtError] = useState<string | null>(null)
  const [mtLoading, setMtLoading] = useState(false)
  const [wikResult, setWikResult] = useState<WiktionaryResult | null>(null)
  const [wikError, setWikError] = useState<string | null>(null)
  const [wikLoading, setWikLoading] = useState(false)
  const [saveTmState, setSaveTmState] = useState<SaveState>('idle')
  const [saveGlossaryState, setSaveGlossaryState] = useState<SaveState>('idle')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const wordCount = useMemo(
    () => input.trim().split(/\s+/).filter(Boolean).length,
    [input],
  )
  const isShortInput = wordCount > 0 && wordCount <= SHORT_INPUT_MAX_WORDS
  const provider = mtSettings ? resolveDefaultProvider(mtSettings) : undefined

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void Promise.all([getMTSettings(), getLookupSettings()]).then(([mt, lookup]) => {
      if (cancelled) return
      setMtSettings(mt)
      setLookupSettings(lookup)
      setTargetLang(lookup.defaultTargetLang)
      if (lookup.lastSourceLang) setSourceLang(lookup.lastSourceLang)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    setInput(prefill)
    setMtResult('')
    setMtError(null)
    setWikResult(null)
    setWikError(null)
    setSaveTmState('idle')
    setSaveGlossaryState('idle')
    if (!prefill) {
      void readClipboard().then((text) => {
        if (text && text.trim()) setInput(text)
      })
    }
    if (autoFocus) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [active, prefill, autoFocus])

  useEffect(() => {
    if (!input.trim()) {
      setDetected('und')
      return
    }
    const { lang } = detectLanguage(input)
    setDetected(lang)
    if (lang !== 'und') setSourceLang(lang)
  }, [input])

  const doLookup = useCallback(async () => {
    const text = input.trim()
    if (!text || !mtSettings) return
    setMtError(null)
    setWikError(null)
    setMtResult('')
    setWikResult(null)
    setSaveTmState('idle')
    setSaveGlossaryState('idle')

    const persistLastLang = settingsRepo.set<Partial<LookupSettings>>(
      LOOKUP_SETTINGS_KEY,
      {
        ...(lookupSettings ?? {}),
        defaultTargetLang: lookupSettings?.defaultTargetLang ?? targetLang,
        lastSourceLang: sourceLang,
      },
    )
    void persistLastLang

    const mtPromise = (async () => {
      if (!provider) {
        setMtError(
          'No MT provider enabled. Open Settings to re-enable MyMemory or add another provider.',
        )
        return
      }
      setMtLoading(true)
      try {
        const res = await translateWith(
          provider,
          { text, sourceLang, targetLang },
          mtSettings,
        )
        setMtResult(res.text)
      } catch (err) {
        if (err instanceof MTError) setMtError(`${err.code}: ${err.message}`)
        else setMtError(err instanceof Error ? err.message : 'MT failed')
      } finally {
        setMtLoading(false)
      }
    })()

    const wikPromise = (async () => {
      if (!isShortInput) return
      if (!online) {
        setWikError("You're offline — Wiktionary unavailable.")
        return
      }
      setWikLoading(true)
      try {
        const res = await fetchWiktionaryEntry(
          text,
          sourceLang === 'und' ? 'en' : sourceLang,
        )
        setWikResult(res)
      } catch (err) {
        if (err instanceof WiktionaryError) {
          setWikError(
            err.code === 'not_found'
              ? `Not in ${sourceLang}.wiktionary.org`
              : err.message,
          )
        } else {
          setWikError(err instanceof Error ? err.message : 'Wiktionary failed')
        }
      } finally {
        setWikLoading(false)
      }
    })()

    await Promise.all([mtPromise, wikPromise])
  }, [input, mtSettings, lookupSettings, provider, sourceLang, targetLang, isShortInput, online])

  const handleSaveToTM = async () => {
    const text = input.trim()
    if (!text || !mtResult.trim()) return
    setSaveTmState('saving')
    try {
      await tmRepo.upsert({
        source: text,
        target: mtResult.trim(),
        sourceLang,
        targetLang,
      })
      setSaveTmState('saved')
    } catch {
      setSaveTmState('error')
    }
  }

  const handleSaveToGlossary = async () => {
    const term = input.trim()
    if (!term) return
    setSaveGlossaryState('saving')
    try {
      const translations: Record<string, string> = {}
      if (mtResult.trim()) translations[targetLang] = mtResult.trim()
      if (wikResult) {
        for (const [l, value] of Object.entries(wikResult.translations)) {
          if (!translations[l]) translations[l] = value
        }
      }
      const definition = wikResult?.definitions[0]?.definition ?? ''
      const entry: GlossaryEntry = {
        id: crypto.randomUUID(),
        term,
        definition,
        translations,
        notes: undefined,
      }
      await glossaryRepo.create(entry)
      setSaveGlossaryState('saved')
    } catch {
      setSaveGlossaryState('error')
    }
  }

  const handleCopy = async () => {
    if (!mtResult) return
    try {
      await navigator.clipboard.writeText(mtResult)
    } catch {
      // clipboard access denied — silent
    }
  }

  const handlePaste = async () => {
    const text = await readClipboard()
    if (text) setInput(text)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className="text-footnote font-medium"
            style={{ color: 'var(--color-muted)' }}
          >
            Term or sentence
          </span>
          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex items-center gap-1 text-footnote px-2.5 h-8 rounded-full border transition-colors hover:bg-[var(--color-fill)]"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-muted)',
            }}
            data-testid={`${testIdPrefix}-paste`}
          >
            <ClipboardPaste size={14} />
            Paste
          </button>
        </div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void doLookup()
            }
          }}
          placeholder="Paste a term or sentence…"
          rows={4}
          data-testid={`${testIdPrefix}-input`}
        />
        <div
          className="text-caption"
          style={{ color: 'var(--color-muted)' }}
        >
          {wordCount === 0
            ? 'Tip: Cmd/Ctrl+Enter to translate'
            : isShortInput
            ? `Short input · ${wordCount} word${wordCount === 1 ? '' : 's'} · Wiktionary + MT`
            : `Sentence · ${wordCount} words · MT only`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label
          className="flex flex-col gap-1 text-footnote"
          style={{ color: 'var(--color-muted)' }}
        >
          Source
          <Select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            data-testid={`${testIdPrefix}-source-lang`}
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {detected !== 'und' && detected !== sourceLang && (
            <span
              className="text-caption"
              style={{ color: 'var(--color-warning)' }}
            >
              Detected: {getLanguageLabel(detected)}
            </span>
          )}
        </label>
        <label
          className="flex flex-col gap-1 text-footnote"
          style={{ color: 'var(--color-muted)' }}
        >
          Target
          <Select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            data-testid={`${testIdPrefix}-target-lang`}
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Button
        onClick={() => void doLookup()}
        disabled={!input.trim() || mtLoading || wikLoading}
        size="lg"
        data-testid={`${testIdPrefix}-go`}
      >
        {mtLoading || wikLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Search />
        )}
        Translate
      </Button>

      {wikResult && (
        <section
          className="flex flex-col gap-2 rounded-lg border p-4"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
          data-testid={`${testIdPrefix}-wiktionary`}
        >
          <span
            className="text-footnote font-semibold"
            style={{ color: 'var(--color-muted)' }}
          >
            Wiktionary · {wikResult.term}
          </span>
          {wikResult.definitions.length > 0 && (
            <ol className="list-decimal list-inside text-callout flex flex-col gap-1">
              {wikResult.definitions.slice(0, 4).map((d, i) => (
                <li key={i} style={{ color: 'var(--color-text)' }}>
                  <span
                    className="italic text-footnote mr-1"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {d.partOfSpeech}
                  </span>
                  {d.definition}
                </li>
              ))}
            </ol>
          )}
          {Object.keys(wikResult.translations).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(wikResult.translations)
                .slice(0, 12)
                .map(([l, value]) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-footnote"
                    style={{
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      background: 'var(--color-bg)',
                    }}
                  >
                    <span style={{ color: 'var(--color-muted)' }}>{l}</span>
                    <span>{value}</span>
                  </span>
                ))}
            </div>
          )}
        </section>
      )}
      {wikError && (
        <p className="text-footnote" style={{ color: 'var(--color-warning)' }}>
          {wikError}
        </p>
      )}

      {mtResult && (
        <section
          className="flex flex-col gap-2 rounded-lg border p-4"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
          data-testid={`${testIdPrefix}-mt`}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-footnote font-semibold"
              style={{ color: 'var(--color-muted)' }}
            >
              MT · {getLanguageLabel(sourceLang)} → {getLanguageLabel(targetLang)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy translation"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-fill)]"
              style={{ color: 'var(--color-muted)' }}
              data-testid={`${testIdPrefix}-copy`}
            >
              <Copy size={16} />
            </button>
          </div>
          <p
            className="text-body whitespace-pre-wrap"
            style={{ color: 'var(--color-text)' }}
          >
            {mtResult}
          </p>
        </section>
      )}
      {mtError && (
        <p className="text-footnote" style={{ color: 'var(--color-error)' }}>
          {mtError}
          {!provider && (
            <>
              {' '}
              <Link
                to="/settings"
                className="underline"
                style={{ color: 'var(--color-error)' }}
              >
                Open Settings
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button
          variant="bordered"
          size="sm"
          onClick={() => void handleSaveToGlossary()}
          disabled={!input.trim() || saveGlossaryState === 'saving'}
          data-testid={`${testIdPrefix}-save-glossary`}
        >
          {saveGlossaryState === 'saved' ? 'Added to glossary' : 'Save to glossary'}
        </Button>
        <Button
          variant="bordered"
          size="sm"
          onClick={() => void handleSaveToTM()}
          disabled={!mtResult.trim() || saveTmState === 'saving'}
          data-testid={`${testIdPrefix}-save-tm`}
        >
          {saveTmState === 'saved' ? 'Added to TM' : 'Save to TM'}
        </Button>
      </div>
    </div>
  )
}

async function readClipboard(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
