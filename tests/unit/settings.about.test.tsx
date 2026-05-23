import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsPage from '@/features/settings'

describe('SettingsPage About section', () => {
  it('renders the injected version, build SHA, and build time', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('settings-version')).toHaveTextContent('0.0.0-test')
    expect(screen.getByTestId('settings-build-sha')).toHaveTextContent('testsha')
    expect(screen.getByTestId('settings-build-time')).toHaveTextContent(
      '2026-01-01T00:00:00.000Z',
    )
  })

  it('includes the offline copy', () => {
    render(<SettingsPage />)
    expect(
      screen.getByText(/translation memory and glossary work fully offline/i),
    ).toBeInTheDocument()
  })
})
