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
    </div>
  )
}
