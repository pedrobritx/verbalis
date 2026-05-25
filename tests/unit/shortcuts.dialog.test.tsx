import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { act } from 'react'
import { GlobalShortcuts } from '@/features/command-palette/useGlobalShortcuts'
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog'
import { useShortcutsStore } from '@/features/shortcuts/useShortcutsStore'

afterEach(() => {
  act(() => useShortcutsStore.setState({ open: false }))
  cleanup()
})

describe('Shortcuts cheat-sheet', () => {
  it('opens on "?" when no input is focused', () => {
    render(
      <>
        <GlobalShortcuts />
        <ShortcutsDialog />
      </>,
    )
    expect(useShortcutsStore.getState().open).toBe(false)
    act(() => {
      fireEvent.keyDown(window, { key: '?' })
    })
    expect(useShortcutsStore.getState().open).toBe(true)
    expect(screen.getByText(/Keyboard shortcuts/i)).toBeInTheDocument()
  })

  it('does not open when "?" is pressed inside a text input', () => {
    render(
      <>
        <input data-testid="probe" />
        <GlobalShortcuts />
        <ShortcutsDialog />
      </>,
    )
    const input = screen.getByTestId('probe')
    input.focus()
    act(() => {
      fireEvent.keyDown(input, { key: '?' })
    })
    expect(useShortcutsStore.getState().open).toBe(false)
  })
})
