import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DEFAULT_EDITOR_SETTINGS,
  EDITOR_SETTINGS_KEY,
  mergeEditorSettings,
  settingsRepo,
  type EditorSettings,
} from '@/storage/repositories/settingsRepo'
import { QA_CODES, QA_RULE_LABELS, DEFAULT_QA_RULES, type QACode } from '@/core/qa/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DEFAULT_AUTOCORRECT_RULES, type AutocorrectRule } from '@/core/text/autocorrect'

export function EditorSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<EditorSettings>>(EDITOR_SETTINGS_KEY),
    [],
  )
  const [draft, setDraft] = useState<EditorSettings>({
    ...DEFAULT_EDITOR_SETTINGS,
    qaRules: { ...DEFAULT_QA_RULES },
  })

  useEffect(() => {
    if (stored !== undefined) setDraft(mergeEditorSettings(stored ?? undefined))
  }, [stored])

  const save = async (next: EditorSettings) => {
    setDraft(next)
    await settingsRepo.set(EDITOR_SETTINGS_KEY, next)
  }

  const setRule = (code: QACode, value: boolean) =>
    void save({ ...draft, qaRules: { ...draft.qaRules, [code]: value } })

  const setAutocorrectRules = (rules: AutocorrectRule[]) =>
    void save({ ...draft, autocorrect: { ...draft.autocorrect, rules } })

  const thresholdPct = Math.round(draft.pretranslateThreshold * 100)

  return (
    <div className="flex flex-col gap-4">
      <label
        className="flex items-center justify-between gap-3 text-callout"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex flex-col">
          Auto-propagate repeated segments
          <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            Confirming a segment fills identical untranslated ones as drafts.
          </span>
        </span>
        <input
          type="checkbox"
          checked={draft.autoPropagate}
          onChange={(e) => void save({ ...draft, autoPropagate: e.target.checked })}
          data-testid="settings-auto-propagate"
        />
      </label>

      <label
        className="flex items-center justify-between gap-3 text-callout"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex flex-col">
          Rich text editing
          <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            Edit targets with bold/italic/underline, sub-/superscript and case
            transforms. Code segments stay plain.
          </span>
        </span>
        <input
          type="checkbox"
          checked={draft.richEditing}
          onChange={(e) => void save({ ...draft, richEditing: e.target.checked })}
          data-testid="settings-rich-editing"
        />
      </label>

      <label className="flex flex-col gap-1 text-footnote" style={{ color: 'var(--color-muted)' }}>
        Pre-translate threshold: {thresholdPct}%
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={thresholdPct}
          onChange={(e) =>
            void save({ ...draft, pretranslateThreshold: Number(e.target.value) / 100 })
          }
          data-testid="settings-pretranslate-threshold"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-footnote font-semibold" style={{ color: 'var(--color-muted)' }}>
          Quality assurance checks
        </span>
        {QA_CODES.map((code) => (
          <label
            key={code}
            className="flex items-center justify-between gap-3 text-callout"
            style={{ color: 'var(--color-text)' }}
          >
            {QA_RULE_LABELS[code]}
            <input
              type="checkbox"
              checked={draft.qaRules[code]}
              onChange={(e) => setRule(code, e.target.checked)}
              data-testid={`settings-qa-${code}`}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="flex items-center justify-between gap-3 text-callout"
          style={{ color: 'var(--color-text)' }}
        >
          <span className="flex flex-col">
            AutoCorrect while typing
            <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
              Expand shorthand as you type in the plain editor (e.g. “eg” → “e.g.”).
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.autocorrect.enabled}
            onChange={(e) =>
              void save({
                ...draft,
                autocorrect: { ...draft.autocorrect, enabled: e.target.checked },
              })
            }
            data-testid="settings-autocorrect-enabled"
          />
        </label>

        {draft.autocorrect.enabled && (
          <div className="flex flex-col gap-2" data-testid="settings-autocorrect-rules">
            {draft.autocorrect.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Replace ${i + 1}`}
                  value={rule.from}
                  placeholder="eg"
                  className="flex-1"
                  onChange={(e) => {
                    const rules = draft.autocorrect.rules.slice()
                    rules[i] = { ...rules[i], from: e.target.value }
                    setAutocorrectRules(rules)
                  }}
                  data-testid={`settings-autocorrect-from-${i}`}
                />
                <span style={{ color: 'var(--color-muted)' }}>→</span>
                <Input
                  aria-label={`With ${i + 1}`}
                  value={rule.to}
                  placeholder="e.g."
                  className="flex-1"
                  onChange={(e) => {
                    const rules = draft.autocorrect.rules.slice()
                    rules[i] = { ...rules[i], to: e.target.value }
                    setAutocorrectRules(rules)
                  }}
                  data-testid={`settings-autocorrect-to-${i}`}
                />
                <Button
                  variant="plain"
                  size="sm"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() =>
                    setAutocorrectRules(draft.autocorrect.rules.filter((_, j) => j !== i))
                  }
                  data-testid={`settings-autocorrect-remove-${i}`}
                >
                  ✕
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button
                variant="bordered"
                size="sm"
                onClick={() =>
                  setAutocorrectRules([...draft.autocorrect.rules, { from: '', to: '' }])
                }
                data-testid="settings-autocorrect-add"
              >
                Add rule
              </Button>
              <Button
                variant="plain"
                size="sm"
                onClick={() => setAutocorrectRules(DEFAULT_AUTOCORRECT_RULES)}
                data-testid="settings-autocorrect-reset"
              >
                Reset to defaults
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
