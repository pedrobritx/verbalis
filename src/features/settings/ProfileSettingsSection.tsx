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
import { useAuthStore } from '@/features/account/useAuthStore'

export function ProfileSettingsSection() {
  const stored = useLiveQuery(
    () => settingsRepo.get<Partial<ProfileSettings>>(PROFILE_SETTINGS_KEY),
    [],
  )
  const [draft, setDraft] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS)
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const accountName = useAuthStore((s) => s.profileDisplayName ?? s.user?.displayName ?? null)

  useEffect(() => {
    if (stored !== undefined) setDraft(mergeProfileSettings(stored ?? undefined))
  }, [stored])

  const handleChange = async (displayName: string) => {
    const next: ProfileSettings = { ...draft, displayName }
    setDraft(next)
    await settingsRepo.set(PROFILE_SETTINGS_KEY, next)
  }

  // Signed in: attribution uses your account name automatically, so there's no
  // separate local name to enter — point at Account settings instead of asking.
  if (signedIn) {
    return (
      <p
        className="text-footnote"
        style={{ color: 'var(--color-muted)' }}
        data-testid="settings-profile-account-note"
      >
        Your name for comments, tracked changes and collaboration comes from your
        account{accountName ? ` — ${accountName}` : ''}. Change it in Account settings.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
        The name attached to your comments, tracked changes and collaboration
        presence. Stored on this device only.
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
