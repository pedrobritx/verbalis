import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { AccountSettingsSection } from '@/features/account/AccountSettingsSection'
import { useAuthStore } from '@/features/account/useAuthStore'
import SettingsPage from '@/features/settings'

afterEach(() => {
  cleanup()
  // Reset to a clean unconfigured baseline between cases.
  useAuthStore.setState({
    status: 'unconfigured',
    user: null,
    profileDisplayName: null,
    identities: null,
    error: null,
  })
})

describe('AccountSettingsSection', () => {
  it('explains that accounts are off on a local-only deployment', () => {
    useAuthStore.setState({ status: 'unconfigured' })
    render(<AccountSettingsSection />)
    expect(screen.getByText(/accounts are not enabled/i)).toBeInTheDocument()
    expect(screen.queryByTestId('account-settings-sign-out')).not.toBeInTheDocument()
  })

  it('invites the user to sign in when signed out', () => {
    useAuthStore.setState({ status: 'unauthenticated', user: null })
    render(<AccountSettingsSection />)
    expect(screen.getByTestId('account-settings-sign-in')).toBeInTheDocument()
    expect(screen.queryByTestId('account-display-name')).not.toBeInTheDocument()
  })

  it('shows the display name, linked identities, and sign out when authenticated', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'jo@example.com', displayName: 'Jo', avatarUrl: null },
      profileDisplayName: 'Jo Cloud',
      identities: [
        { id: 'i-g', provider: 'google', email: 'jo@gmail.com', createdAt: null },
        { id: 'i-e', provider: 'email', email: null, createdAt: null },
      ],
    })
    render(<AccountSettingsSection />)

    expect(screen.getByTestId('account-display-name')).toHaveValue('Jo Cloud')
    expect(screen.getByTestId('account-identity-google')).toHaveTextContent('Google')
    expect(screen.getByTestId('account-identity-email')).toHaveTextContent('Email')
    expect(screen.getByTestId('account-settings-sign-out')).toBeInTheDocument()
  })

  it('saves an edited display name through the store', async () => {
    const updateDisplayName = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'jo@example.com', displayName: 'Jo', avatarUrl: null },
      profileDisplayName: 'Jo',
      identities: [],
      updateDisplayName,
    })
    render(<AccountSettingsSection />)

    const save = screen.getByTestId('account-display-name-save')
    // Save is disabled until the field actually changes.
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByTestId('account-display-name'), {
      target: { value: 'Josephine' },
    })
    expect(save).toBeEnabled()
    fireEvent.click(save)

    await waitFor(() => expect(updateDisplayName).toHaveBeenCalledWith('Josephine'))
  })
})

describe('SettingsPage account nav gating', () => {
  it('hides the Account section on a local-only (unconfigured) deployment', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('settings-nav-identity')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-nav-account')).not.toBeInTheDocument()
  })
})
