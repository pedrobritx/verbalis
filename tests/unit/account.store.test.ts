import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the env-gated Supabase seam so the store exercises its cloud paths
// without a real backend (mirrors the injectable-client invariant). The default
// test env leaves the cloud unconfigured, so we force it on here.
const upsertMock = vi.fn()
const maybeSingleMock = vi.fn()
const getUserIdentitiesMock = vi.fn()

vi.mock('@/storage/cloud/supabaseClient', () => ({
  isCloudConfigured: () => true,
  getSupabase: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      upsert: upsertMock,
    }),
    auth: { getUserIdentities: getUserIdentitiesMock },
  }),
}))

import { useAuthStore } from '@/features/account/useAuthStore'

const AUTH_USER = {
  id: 'user-1',
  email: 'jo@example.com',
  displayName: 'Provider Name',
  avatarUrl: null,
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'authenticated',
    user: { ...AUTH_USER },
    profileDisplayName: null,
    identities: null,
    error: null,
    magicLinkSentTo: null,
  })
  upsertMock.mockReset()
  maybeSingleMock.mockReset()
  getUserIdentitiesMock.mockReset()
})

describe('useAuthStore.loadAccount', () => {
  it('loads the profile name + linked identities and prefers the account name', async () => {
    maybeSingleMock.mockResolvedValue({ data: { display_name: 'Cloud Name' } })
    getUserIdentitiesMock.mockResolvedValue({
      data: {
        identities: [
          {
            identity_id: 'id-g',
            provider: 'google',
            identity_data: { email: 'jo@gmail.com' },
            created_at: '2026-01-01T00:00:00Z',
          },
          { id: 'id-e', provider: 'email', identity_data: null },
        ],
      },
    })

    await useAuthStore.getState().loadAccount()

    const s = useAuthStore.getState()
    expect(s.profileDisplayName).toBe('Cloud Name')
    expect(s.user?.displayName).toBe('Cloud Name')
    expect(s.identities).toEqual([
      { id: 'id-g', provider: 'google', email: 'jo@gmail.com', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'id-e', provider: 'email', email: null, createdAt: null },
    ])
  })

  it('keeps the provider name when the profile row has no display name', async () => {
    maybeSingleMock.mockResolvedValue({ data: { display_name: null } })
    getUserIdentitiesMock.mockResolvedValue({ data: { identities: [] } })

    await useAuthStore.getState().loadAccount()

    const s = useAuthStore.getState()
    expect(s.profileDisplayName).toBeNull()
    expect(s.user?.displayName).toBe('Provider Name')
    expect(s.identities).toEqual([])
  })
})

describe('useAuthStore.updateDisplayName', () => {
  it('upserts the trimmed name and reflects it in the menu user', async () => {
    upsertMock.mockResolvedValue({ error: null })

    await useAuthStore.getState().updateDisplayName('  New Name  ')

    expect(upsertMock).toHaveBeenCalledWith({ id: 'user-1', display_name: 'New Name' })
    const s = useAuthStore.getState()
    expect(s.profileDisplayName).toBe('New Name')
    expect(s.user?.displayName).toBe('New Name')
    expect(s.error).toBeNull()
  })

  it('stores null and falls back to the provider name when cleared', async () => {
    upsertMock.mockResolvedValue({ error: null })

    await useAuthStore.getState().updateDisplayName('   ')

    expect(upsertMock).toHaveBeenCalledWith({ id: 'user-1', display_name: null })
    const s = useAuthStore.getState()
    expect(s.profileDisplayName).toBeNull()
    expect(s.user?.displayName).toBe('Provider Name')
  })

  it('surfaces the error and leaves the name unchanged on failure', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'row-level security' } })

    await useAuthStore.getState().updateDisplayName('Nope')

    const s = useAuthStore.getState()
    expect(s.error).toBe('row-level security')
    expect(s.profileDisplayName).toBeNull()
    expect(s.user?.displayName).toBe('Provider Name')
  })
})
