import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Select } from '@/components/ui/select'
import { LANG_OPTIONS } from '@/core/lang/options'
import {
  DEFAULT_LOOKUP_SETTINGS,
  mergeLookupSettings,
  settingsRepo,
  LOOKUP_SETTINGS_KEY,
} from '@/storage/repositories/settingsRepo'
import type { LookupSettings } from '@/core/types'

export function LookupSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<LookupSettings>>(LOOKUP_SETTINGS_KEY),
    [],
  )
  const [draft, setDraft] = useState<LookupSettings>(DEFAULT_LOOKUP_SETTINGS)

  useEffect(() => {
    if (stored !== undefined) setDraft(mergeLookupSettings(stored ?? undefined))
  }, [stored])

  const handleChange = async (defaultTargetLang: string) => {
    const next: LookupSettings = { ...draft, defaultTargetLang }
    setDraft(next)
    await settingsRepo.set(LOOKUP_SETTINGS_KEY, next)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        Default target language for the global Quick Lookup dialog. Source
        language is auto-detected per lookup.
      </p>
      <label className="flex flex-col gap-1 text-footnote" style={{ color: 'var(--color-muted)' }}>
        Default target language
        <Select
          value={draft.defaultTargetLang}
          onChange={(e) => void handleChange(e.target.value)}
          data-testid="settings-lookup-default-target"
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  )
}
