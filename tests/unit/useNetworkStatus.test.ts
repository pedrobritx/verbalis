import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('useNetworkStatus', () => {
  let originalDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine')
    setOnline(true)
  })

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', originalDescriptor)
    }
  })

  it('returns true when navigator is online', () => {
    setOnline(true)
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(true)
  })

  it('updates to false when an offline event fires', () => {
    setOnline(true)
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(true)

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('updates back to true when an online event fires', () => {
    setOnline(false)
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(false)

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })
})
