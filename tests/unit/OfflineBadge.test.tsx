import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineBadge } from '@/components/layout/OfflineBadge'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('OfflineBadge', () => {
  let originalDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator),
      'onLine',
    )
    setOnline(true)
  })

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', originalDescriptor)
    }
  })

  it('renders nothing when online', () => {
    setOnline(true)
    render(<OfflineBadge />)
    expect(screen.queryByTestId('offline-badge')).toBeNull()
  })

  it('renders the badge after the window goes offline', () => {
    setOnline(true)
    render(<OfflineBadge />)
    expect(screen.queryByTestId('offline-badge')).toBeNull()

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })

    const badge = screen.getByTestId('offline-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/offline/i)
  })
})
