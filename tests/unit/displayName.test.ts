import { describe, it, expect } from 'vitest'
import {
  resolveDisplayName,
  SELF_NAME_FALLBACK,
  PEER_NAME_FALLBACK,
  type AuthNameSlice,
} from '@/features/account/displayName'

const user = (displayName: string | null): AuthNameSlice['user'] => ({
  id: 'u1',
  email: 'a@b.c',
  displayName,
  avatarUrl: null,
})

const signedOut: AuthNameSlice = { status: 'unauthenticated', user: null, profileDisplayName: null }

describe('resolveDisplayName', () => {
  it('prefers the account profile name when signed in', () => {
    const auth: AuthNameSlice = {
      status: 'authenticated',
      user: user('Meta Name'),
      profileDisplayName: 'Account Name',
    }
    expect(resolveDisplayName('Local', auth)).toBe('Account Name')
  })

  it('falls back to the user metadata name when the profile name is empty', () => {
    const auth: AuthNameSlice = {
      status: 'authenticated',
      user: user('Meta Name'),
      profileDisplayName: null,
    }
    expect(resolveDisplayName('Local', auth)).toBe('Meta Name')
  })

  it('uses the local name when signed in but the account has no name', () => {
    const auth: AuthNameSlice = {
      status: 'authenticated',
      user: user(null),
      profileDisplayName: '  ',
    }
    expect(resolveDisplayName('Local', auth)).toBe('Local')
  })

  it('uses the local name when signed out', () => {
    expect(resolveDisplayName('Local', signedOut)).toBe('Local')
  })

  it('falls back to the friendly default when nothing is set', () => {
    expect(resolveDisplayName('', signedOut)).toBe(SELF_NAME_FALLBACK)
    expect(resolveDisplayName(undefined, signedOut)).toBe(SELF_NAME_FALLBACK)
  })

  it('honours a custom fallback (e.g. peer presence)', () => {
    expect(resolveDisplayName(null, signedOut, PEER_NAME_FALLBACK)).toBe(PEER_NAME_FALLBACK)
    expect(PEER_NAME_FALLBACK).not.toBe(SELF_NAME_FALLBACK)
  })

  it('does not use the account name for a non-authenticated status', () => {
    const loading: AuthNameSlice = {
      status: 'loading',
      user: user('Meta'),
      profileDisplayName: 'Account',
    }
    expect(resolveDisplayName('Local', loading)).toBe('Local')
  })
})
