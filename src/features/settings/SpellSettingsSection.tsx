import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import {
  SPELL_SETTINGS_KEY,
  mergeSpellSettings,
  settingsRepo,
  type SpellSettings,
} from '@/storage/repositories/settingsRepo'

export function SpellSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<SpellSettings>>(SPELL_SETTINGS_KEY),
    [],
  )
  const settings = useMemo(() => mergeSpellSettings(stored ?? undefined), [stored])

  const save = (next: SpellSettings) => void settingsRepo.set(SPELL_SETTINGS_KEY, next)

  return (
    <div className="flex flex-col gap-3">
      <label
        className="flex items-center justify-between gap-3 text-callout"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex flex-col">
          On-device spell-check
          <span className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            Hunspell dictionaries run locally; the active one follows each project's
            target language (English and Portuguese ship today). Nothing is uploaded.
          </span>
        </span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => save({ ...settings, enabled: e.target.checked })}
          data-testid="settings-spell-enabled"
        />
      </label>

      {settings.personalWords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-footnote font-semibold" style={{ color: 'var(--color-muted)' }}>
            Personal dictionary ({settings.personalWords.length})
          </span>
          <div className="flex flex-wrap gap-1" data-testid="settings-spell-personal">
            {settings.personalWords.map((w) => (
              <span
                key={w}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                {w}
                <button
                  aria-label={`Remove ${w}`}
                  onClick={() =>
                    save({
                      ...settings,
                      personalWords: settings.personalWords.filter((x) => x !== w),
                    })
                  }
                  style={{ color: 'var(--color-muted)' }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <Button
            variant="plain"
            size="sm"
            onClick={() => save({ ...settings, personalWords: [] })}
            data-testid="settings-spell-clear"
            className="self-start"
          >
            Clear personal dictionary
          </Button>
        </div>
      )}
    </div>
  )
}
