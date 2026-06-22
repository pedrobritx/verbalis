import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus } from 'lucide-react'
import { segmentRepo } from '@/storage/repositories/segmentRepo'
import {
  SPELL_SETTINGS_KEY,
  mergeSpellSettings,
  settingsRepo,
  type SpellSettings,
} from '@/storage/repositories/settingsRepo'
import type { WordToken } from '@/core/spell/tokenize'
import { useSpell } from './useSpell'

interface SpellPanelProps {
  targetLang: string
  focusedTarget: string | undefined
  focusedSegmentId: string | undefined
}

interface Mistake {
  token: WordToken
  suggestions: string[]
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs" style={{ color: 'var(--color-muted)' }} data-testid="spell-hint">
      {children}
    </p>
  )
}

export function SpellPanel({ targetLang, focusedTarget, focusedSegmentId }: SpellPanelProps) {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<SpellSettings>>(SPELL_SETTINGS_KEY),
    [],
  )
  const settings = useMemo(() => mergeSpellSettings(stored ?? undefined), [stored])
  const { lang, state, check, suggest, addWord } = useSpell(
    targetLang,
    settings.enabled,
    settings.personalWords,
  )

  const [mistakes, setMistakes] = useState<Mistake[] | null>(null)
  const [ignored, setIgnored] = useState<Set<string>>(new Set())
  const text = focusedTarget ?? ''

  useEffect(() => {
    if (state !== 'ready') {
      setMistakes(null)
      return
    }
    let active = true
    void (async () => {
      const tokens = await check(text)
      if (!active) return
      const visible = tokens.filter((t) => !ignored.has(t.word.toLowerCase()))
      const withSuggestions = await Promise.all(
        visible.map(async (token) => ({ token, suggestions: (await suggest(token.word)).slice(0, 5) })),
      )
      if (active) setMistakes(withSuggestions)
    })()
    return () => {
      active = false
    }
  }, [text, state, check, suggest, ignored])

  async function applyFix(token: WordToken, replacement: string) {
    if (!focusedSegmentId) return
    const next = text.slice(0, token.start) + replacement + text.slice(token.end)
    // Drop targetRich so the rich editor rebuilds from the corrected plain text,
    // consistent with how TM/MT apply works.
    await segmentRepo.update(focusedSegmentId, { target: next, targetRich: undefined })
  }

  async function addToDictionary(word: string) {
    await addWord(word)
    await settingsRepo.set(SPELL_SETTINGS_KEY, {
      ...settings,
      personalWords: Array.from(new Set([...settings.personalWords, word])),
    })
    setIgnored((s) => new Set(s).add(word.toLowerCase()))
  }

  function ignore(word: string) {
    setIgnored((s) => new Set(s).add(word.toLowerCase()))
  }

  if (!settings.enabled) {
    return (
      <Hint>
        Spell-check is off.{' '}
        <Link to="/settings" className="underline">
          Enable it in Settings
        </Link>
        .
      </Hint>
    )
  }
  if (state === 'unsupported') return <Hint>No bundled dictionary for “{targetLang}”.</Hint>
  if (state === 'loading') return <Hint>Loading the {lang?.toUpperCase()} dictionary…</Hint>
  if (state === 'error') return <Hint>Dictionary unavailable (offline and not yet cached).</Hint>
  if (!focusedSegmentId) return <Hint>Focus a segment to check its spelling.</Hint>
  if (mistakes === null) return <Hint>Checking…</Hint>

  if (mistakes.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border p-3 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        data-testid="spell-clean"
      >
        <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
        No spelling issues in this segment.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="spell-results">
      {mistakes.map(({ token, suggestions }, i) => (
        <div
          key={`${token.word}-${token.start}-${i}`}
          className="flex flex-col gap-1.5 rounded-md border p-2.5 text-xs"
          style={{ borderColor: 'var(--color-border)' }}
          data-testid="spell-mistake"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-semibold"
              style={{ color: 'var(--color-error)', textDecoration: 'underline wavy' }}
            >
              {token.word}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void addToDictionary(token.word)}
                className="inline-flex items-center gap-0.5 hover:opacity-80"
                style={{ color: 'var(--color-muted)' }}
                data-testid="spell-add"
                title="Add to personal dictionary"
              >
                <Plus size={12} /> Add
              </button>
              <button
                onClick={() => ignore(token.word)}
                className="hover:opacity-80"
                style={{ color: 'var(--color-muted)' }}
                data-testid="spell-ignore"
              >
                Ignore
              </button>
            </div>
          </div>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => void applyFix(token, s)}
                  className="rounded border px-1.5 py-0.5 transition-colors hover:bg-[var(--color-fill)]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  data-testid="spell-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--color-muted)' }}>No suggestions.</span>
          )}
        </div>
      ))}
    </div>
  )
}
