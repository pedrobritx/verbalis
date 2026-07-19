import { useEffect, useState } from 'react'
import { LogOut, User as UserIcon } from 'lucide-react'
import { isCloudConfigured } from '@/storage/cloud/supabaseClient'
import { useAuthStore } from './useAuthStore'
import { SignInDialog } from './SignInDialog'

function initials(name: string | null, email: string | null): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/**
 * Top-bar account control (ROADMAP §3.1). Rendered only when the deployment is
 * cloud-configured, so local-only builds show nothing new. Signed out → a
 * "Sign in" button opening the {@link SignInDialog}; signed in → an avatar with
 * a small menu (identity + sign out).
 */
export function AccountMenu() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const init = useAuthStore((s) => s.init)
  const signOut = useAuthStore((s) => s.signOut)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  // Never render for local-only deployments (defensive; TopBar also gates).
  if (!isCloudConfigured() || status === 'unconfigured') return null

  if (status !== 'authenticated' || !user) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-muted)',
            background: 'transparent',
          }}
          aria-label="Sign in"
          data-testid="account-sign-in"
          disabled={status === 'loading'}
        >
          <UserIcon size={14} />
          <span className="hidden sm:inline">Sign in</span>
        </button>
        <SignInDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent-fill)', color: 'var(--color-accent)' }}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-testid="account-avatar"
      >
        {initials(user.displayName, user.email)}
      </button>

      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 rounded-md border p-1 shadow-lg"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
            }}
            data-testid="account-menu"
          >
            <div className="px-2 py-1.5">
              <p
                className="truncate text-sm font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {user.displayName || 'Signed in'}
              </p>
              {user.email ? (
                <p className="truncate text-xs" style={{ color: 'var(--color-muted)' }}>
                  {user.email}
                </p>
              ) : null}
            </div>
            <div className="my-1 h-px" style={{ background: 'var(--color-border)' }} />
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                void signOut()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-fill)]"
              style={{ color: 'var(--color-text)' }}
              data-testid="account-sign-out"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
