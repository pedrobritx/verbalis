import { useAuthStore, type AuthUser, type AuthStatus } from './useAuthStore'

/**
 * The effective display name for authored actions — tracked changes, comments,
 * collaboration presence, version sign-off. When signed in, the account name is
 * used automatically, so a signed-in user never has to enter a separate local
 * name. Otherwise the device-local name is used, and only when neither exists
 * does a friendly fallback show.
 *
 * Two fallbacks, because the word differs by audience: your own unnamed
 * attribution reads as "You"; an unnamed peer shown to *others* reads as
 * "Anonymous".
 */
export const SELF_NAME_FALLBACK = 'You'
export const PEER_NAME_FALLBACK = 'Anonymous'

/** The auth fields the resolver reads — a slice, so it is pure and testable. */
export interface AuthNameSlice {
  status: AuthStatus
  user: AuthUser | null
  profileDisplayName: string | null
}

/**
 * Resolve the effective name: signed-in account name → device-local name →
 * `fallback`. Pure over the auth slice.
 */
export function resolveDisplayName(
  local: string | null | undefined,
  auth: AuthNameSlice,
  fallback: string = SELF_NAME_FALLBACK,
): string {
  if (auth.status === 'authenticated') {
    const account = (auth.profileDisplayName ?? auth.user?.displayName ?? '').trim()
    if (account) return account
  }
  return (local ?? '').trim() || fallback
}

/** Reactive `resolveDisplayName` bound to the auth store. */
export function useDisplayName(
  local: string | null | undefined,
  fallback: string = SELF_NAME_FALLBACK,
): string {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName)
  return resolveDisplayName(local, { status, user, profileDisplayName }, fallback)
}
