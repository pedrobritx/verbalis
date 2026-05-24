import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ClipboardPaste, Copy, Languages, Loader2, Search, X } from 'lucide-react'
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
import { useQuickLookupStore } from './useQuickLookupStore'
import type { GlossaryEntry, LookupSettings, MTSettings } from '@/core/types'

const SHORT_INPUT_MAX_WORDS = 4

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function QuickLookupDialog() {
  const open = useQuickLookupStore((s) => s.open)
  const prefill = useQuickLookupStore((s) => s.prefill)
  const close = useQuickLookupStore((s) => s.close)
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

  const wordCount = useMemo(() => input.trim().split(/\s+/).filter(Boolean).length, [input])
  const isShortInput = wordCount > 0 && wordCount <= SHORT_INPUT_MAX_WORDS
  const provider = mtSettings ? resolveDefaultProvider(mtSettings) : undefined

  useEffect(() => {
    if (!open) return
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
  }, [open])

  useEffect(() => {
    if (!open) return
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
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open, prefill])

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

    const persistLastLang = settingsRepo.set<Partial<LookupSettings>>(LOOKUP_SETTINGS_KEY, {
      ...(lookupSettings ?? {}),
      defaultTargetLang: lookupSettings?.defaultTargetLang ?? targetLang,
      lastSourceLang: sourceLang,
    })
    void persistLastLang

    const mtPromise = (async () => {
      if (!provider) {
        setMtError('No MT provider enabled. Configure one in Settings.')
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
        const res = await fetchWiktionaryEntry(text, sourceLang === 'und' ? 'en' : sourceLang)
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
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="quick-lookup-dialog"
          className="fixed z-50 flex flex-col border shadow-2xl
            inset-x-0 bottom-0 rounded-t-xl
            md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-[min(640px,92vw)] md:rounded-lg md:border
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom
            md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95
            md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-top-[48%]"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            maxHeight: '90dvh',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <DialogPrimitive.Title
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              <Languages size={16} />
              Quick lookup
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="p-1.5 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Term or sentence
                </span>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                  data-testid="quick-lookup-paste"
                >
                  <ClipboardPaste size={12} />
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
                rows={3}
                data-testid="quick-lookup-input"
              />
              <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                {wordCount === 0
                  ? 'Tip: Cmd/Ctrl+Enter to look up'
                  : isShortInput
                  ? `Short input · ${wordCount} word${wordCount === 1 ? '' : 's'} · Wiktionary + MT`
                  : `Sentence · ${wordCount} words · MT only`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                Source
                <Select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  data-testid="quick-lookup-source-lang"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {detected !== 'und' && detected !== sourceLang && (
                  <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
                    Detected: {getLanguageLabel(detected)}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                Target
                <Select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  data-testid="quick-lookup-target-lang"
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
              data-testid="quick-lookup-go"
            >
              {mtLoading || wikLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search />
              )}
              Look up
            </Button>

            {wikResult && (
              <section
                className="flex flex-col gap-2 rounded-md border p-3"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                data-testid="quick-lookup-wiktionary"
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                  Wiktionary · {wikResult.term}
                </span>
                {wikResult.definitions.length > 0 && (
                  <ol className="list-decimal list-inside text-sm flex flex-col gap-1">
                    {wikResult.definitions.slice(0, 4).map((d, i) => (
                      <li key={i} style={{ color: 'var(--color-text)' }}>
                        <span className="italic text-xs mr-1" style={{ color: 'var(--color-muted)' }}>
                          {d.partOfSpeech}
                        </span>
                        {d.definition}
                      </li>
                    ))}
                  </ol>
                )}
                {Object.keys(wikResult.translations).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(wikResult.translations)
                      .slice(0, 12)
                      .map(([l, value]) => (
                        <span
                          key={l}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
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
              <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                {wikError}
              </p>
            )}

            {mtResult && (
              <section
                className="flex flex-col gap-2 rounded-md border p-3"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                data-testid="quick-lookup-mt"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                    MT · {getLanguageLabel(sourceLang)} → {getLanguageLabel(targetLang)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy translation"
                    className="p-1 rounded transition-colors hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                    data-testid="quick-lookup-copy"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                  {mtResult}
                </p>
              </section>
            )}
            {mtError && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                {mtError}
              </p>
            )}
          </div>

          <div
            className="flex items-center justify-end gap-2 px-4 py-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveToGlossary()}
              disabled={!input.trim() || saveGlossaryState === 'saving'}
              data-testid="quick-lookup-save-glossary"
            >
              {saveGlossaryState === 'saved' ? 'Added to glossary' : 'Save to glossary'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveToTM()}
              disabled={!mtResult.trim() || saveTmState === 'saving'}
              data-testid="quick-lookup-save-tm"
            >
              {saveTmState === 'saved' ? 'Added to TM' : 'Save to TM'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
