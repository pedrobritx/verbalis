import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateBanner } from '@/pwa/UpdateBanner'
import { usePwaStore } from '@/pwa/usePwaStore'

describe('UpdateBanner', () => {
  beforeEach(() => {
    usePwaStore.setState({
      needRefresh: false,
      offlineReady: false,
      updateSW: null,
    })
  })

  it('renders nothing when needRefresh is false', () => {
    render(<UpdateBanner />)
    expect(screen.queryByTestId('pwa-update-banner')).toBeNull()
  })

  it('renders the banner when needRefresh is true', () => {
    usePwaStore.setState({ needRefresh: true })
    render(<UpdateBanner />)
    expect(screen.getByTestId('pwa-update-banner')).toBeInTheDocument()
    expect(screen.getByTestId('pwa-update-reload')).toBeInTheDocument()
  })

  it('invokes updateSW(true) when Reload is clicked', async () => {
    const updateSW = vi.fn().mockResolvedValue(undefined)
    usePwaStore.setState({ needRefresh: true, updateSW })

    const user = userEvent.setup()
    render(<UpdateBanner />)
    await user.click(screen.getByTestId('pwa-update-reload'))

    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('dismiss button hides the banner', async () => {
    usePwaStore.setState({ needRefresh: true })
    const user = userEvent.setup()
    render(<UpdateBanner />)
    await user.click(screen.getByTestId('pwa-update-dismiss'))
    expect(screen.queryByTestId('pwa-update-banner')).toBeNull()
    expect(usePwaStore.getState().needRefresh).toBe(false)
  })
})
