import { useEffect, useState } from 'react'
import { Check, Link2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from './useAuthStore'
import { SignInDialog } from './SignInDialog'

/** Human labels for the identity providers a linked account can carry (3.2). */
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  azure: 'Microsoft',
  apple: 'Apple',
  email: 'Email (magic link)',
}

function providerLabel(id: string): string {
  return PROVIDER_LABEL[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

/**
 * Account settings (ROADMAP §3.2): the signed-in counterpart to the local
 * {@link ProfileSettingsSection}. Lets a signed-in user edit their cloud display
 * name (persisted to the `profiles` row), see which sign-in methods are linked,
 * and sign out. Rendered from the Settings page only when the deployment is
 * cloud-configured; when signed out it invites the user to sign in.
 */
export function AccountSettingsSection() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName)
  const identities = useAuthStore((s) => s.identities)
  const error = useAuthStore((s) => s.error)
  const loadAccount = useAuthStore((s) => s.loadAccount)
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName)
  const signOut = useAuthStore((s) => s.signOut)

  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Fetch the profile row + identities once the user is known.
  useEffect(() => {
    if (status === 'authenticated') void loadAccount()
  }, [status, user?.id, loadAccount])

  // Seed the editable field from whatever the store last loaded.
  useEffect(() => {
    if (profileDisplayName !== null) setDraft(profileDisplayName)
  }, [profileDisplayName])

  if (status === 'unconfigured') {
    return (
      <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
        Accounts are not enabled in this deployment. Verbalis runs 100% locally.
      </p>
    )
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex flex-col gap-3" data-testid="account-settings">
        <p className="text-callout" style={{ color: 'var(--color-muted)' }}>
          Sign in to sync your preferences, term bank, and cloud projects across devices. Verbalis
          stays 100% local until you sign in.
        </p>
        <Button
          variant="filled"
          size="sm"
          className="self-start"
          onClick={() => setDialogOpen(true)}
          disabled={status === 'loading'}
          data-testid="account-settings-sign-in"
        >
          Sign in
        </Button>
        <SignInDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    )
  }

  const currentName = profileDisplayName ?? ''
  const dirty = draft.trim() !== currentName.trim()

  const save = async () => {
    setBusy(true)
    setSaved(false)
    await updateDisplayName(draft)
    setBusy(false)
    // Show the confirmation only when the store didn't record an error.
    if (!useAuthStore.getState().error) {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="account-settings">
      <div className="flex flex-col gap-3">
        <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
          The name shown on your account, comments, and collaboration presence. Synced to the cloud
          and shared across your devices.
        </p>
        <label
          className="flex flex-col gap-1 text-footnote"
          style={{ color: 'var(--color-muted)' }}
        >
          Display name
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              placeholder={user.displayName || 'e.g. Pedro'}
              disabled={busy}
              data-testid="account-display-name"
            />
            <Button
              variant="filled"
              size="sm"
              onClick={() => void save()}
              disabled={busy || !dirty}
              data-testid="account-display-name-save"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saved ? (
                <Check size={16} />
              ) : null}
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </label>
        {error ? (
          <p
            className="text-footnote"
            style={{ color: 'var(--color-error)' }}
            data-testid="account-settings-error"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-footnote font-semibold" style={{ color: 'var(--color-text)' }}>
          Linked sign-in methods
        </h3>
        {identities === null ? (
          <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            <Loader2 size={14} className="mr-1 inline animate-spin" />
            Loading…
          </p>
        ) : identities.length === 0 ? (
          <p className="text-footnote" style={{ color: 'var(--color-muted)' }}>
            No linked identities found.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {identities.map((identity) => (
              <li
                key={identity.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-callout"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                data-testid={`account-identity-${identity.provider}`}
              >
                <Link2 size={14} style={{ color: 'var(--color-muted)' }} />
                <span className="font-medium">{providerLabel(identity.provider)}</span>
                {identity.email ? (
                  <span className="truncate" style={{ color: 'var(--color-muted)' }}>
                    {identity.email}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <Button
          variant="bordered"
          size="sm"
          onClick={() => void signOut()}
          data-testid="account-settings-sign-out"
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </div>
  )
}
