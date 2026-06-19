import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_PROFILE_SETTINGS,
  mergeProfileSettings,
  settingsRepo,
  PROFILE_SETTINGS_KEY,
  type ProfileSettings,
} from '@/storage/repositories/settingsRepo'

export function ProfileSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<ProfileSettings>>(PROFILE_SETTINGS_KEY),
    [],
  )
  const [draft, setDraft] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS)

  useEffect(() => {
    if (stored !== undefined) setDraft(mergeProfileSettings(stored ?? undefined))
  }, [stored])

  const handleChange = async (displayName: string) => {
    const next: ProfileSettings = { ...draft, displayName }
    setDraft(next)
    await settingsRepo.set(PROFILE_SETTINGS_KEY, next)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        The name attached to comments you write. It will also identify you to
        peers once local-network collaboration lands. Stored on this device only.
      </p>
      <label className="flex flex-col gap-1 text-footnote" style={{ color: 'var(--color-muted)' }}>
        Display name
        <Input
          value={draft.displayName}
          onChange={(e) => void handleChange(e.target.value)}
          placeholder="e.g. Pedro"
          data-testid="settings-profile-display-name"
        />
      </label>
    </div>
  )
}
