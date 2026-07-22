import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { configuredProviders } from '@/storage/cloud/supabaseClient'
import { useAuthStore, type OAuthProvider } from './useAuthStore'
import { ProviderIcon } from './ProviderIcon'

/** Human labels for the OAuth providers Supabase Auth exposes (D7). */
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Continue with Google',
  azure: 'Continue with Microsoft',
  apple: 'Continue with Apple',
}

const KNOWN_OAUTH: OAuthProvider[] = ['google', 'azure', 'apple']

function providerLabel(id: string): string {
  return PROVIDER_LABEL[id] ?? `Continue with ${id.charAt(0).toUpperCase()}${id.slice(1)}`
}

interface SignInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const error = useAuthStore((s) => s.error)
  const magicLinkSentTo = useAuthStore((s) => s.magicLinkSentTo)
  const signInWithOAuth = useAuthStore((s) => s.signInWithOAuth)
  const signInWithMagicLink = useAuthStore((s) => s.signInWithMagicLink)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Only offer OAuth providers this deployment actually configured *and* that
  // Supabase Auth natively supports as a redirect provider.
  const providers = configuredProviders().filter((p): p is OAuthProvider =>
    (KNOWN_OAUTH as string[]).includes(p),
  )

  const oauth = async (provider: OAuthProvider) => {
    setBusy(provider)
    await signInWithOAuth(provider)
    setBusy(null)
  }

  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy('magic')
    await signInWithMagicLink(email.trim())
    setBusy(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-testid="sign-in-dialog"
      >
        <DialogHeader>
          <DialogTitle>Sign in to Verbalis</DialogTitle>
          <DialogDescription>
            Sync your preferences, term bank, and cloud projects across devices. Verbalis stays 100%
            local until you sign in.
          </DialogDescription>
        </DialogHeader>

        {magicLinkSentTo ? (
          <div
            className="flex flex-col items-center gap-2 py-4 text-center"
            data-testid="magic-link-sent"
          >
            <Mail size={28} style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>
              Check <span className="font-medium">{magicLinkSentTo}</span> for a sign-in link.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {providers.map((provider) => (
              <Button
                key={provider}
                variant="bordered"
                onClick={() => oauth(provider)}
                disabled={busy !== null}
                data-testid={`oauth-${provider}`}
              >
                {busy === provider ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ProviderIcon provider={provider} />
                )}
                {providerLabel(provider)}
              </Button>
            ))}

            <div className="flex items-center gap-2 py-1">
              <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                or
              </span>
              <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
            </div>

            <form onSubmit={magicLink} className="flex flex-col gap-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy !== null}
                data-testid="magic-link-email"
              />
              <Button
                type="submit"
                variant="filled"
                disabled={busy !== null || !email.trim()}
                data-testid="magic-link-submit"
              >
                {busy === 'magic' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mail size={16} />
                )}
                Email me a magic link
              </Button>
            </form>
          </div>
        )}

        {error ? (
          <p className="text-sm" style={{ color: 'var(--color-error)' }} data-testid="auth-error">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
