import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from '@/features/settings'

function openAbout() {
  render(<SettingsPage />)
  fireEvent.click(screen.getByTestId('settings-nav-about'))
}

describe('SettingsPage About section', () => {
  it('renders the injected version, build SHA, and build time', () => {
    openAbout()
    expect(screen.getByTestId('settings-version')).toHaveTextContent('0.0.0-test')
    expect(screen.getByTestId('settings-build-sha')).toHaveTextContent('testsha')
    expect(screen.getByTestId('settings-build-time')).toHaveTextContent('2026-01-01T00:00:00.000Z')
  })

  it('includes the offline copy', () => {
    openAbout()
    expect(
      screen.getByText(/translation memory and glossary work fully offline/i),
    ).toBeInTheDocument()
  })

  it('shows the section rail with all groups', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('settings-nav')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-identity')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-mt')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-spell')).toBeInTheDocument()
  })
})
