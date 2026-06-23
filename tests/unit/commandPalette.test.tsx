import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { GlobalShortcuts } from '@/features/command-palette/useGlobalShortcuts'
import { useCommandPaletteStore } from '@/features/command-palette/useCommandPaletteStore'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'
import { useImportDialogStore } from '@/features/import/useImportDialogStore'
import { useQuickLookupStore } from '@/features/lookup/useQuickLookupStore'

function LocationProbe() {
  const loc = useLocation()
  return <span data-testid="loc">{loc.pathname}</span>
}

function Harness() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <GlobalShortcuts />
      <CommandPalette />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useCommandPaletteStore.setState({ open: false })
  useEditorModeStore.setState({ stage: 'translate', reviewMode: false, statusFilter: 'all' })
  useImportDialogStore.setState({ open: false })
  useQuickLookupStore.setState({ open: false, prefill: '' })
})

afterEach(() => {
  cleanup()
})

describe('CommandPalette', () => {
  it('opens via Ctrl+K and closes via the same shortcut', async () => {
    render(<Harness />)
    expect(useCommandPaletteStore.getState().open).toBe(false)

    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(useCommandPaletteStore.getState().open).toBe(true)

    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('Ctrl+Shift+R toggles review mode', () => {
    render(<Harness />)
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
    act(() => {
      fireEvent.keyDown(window, { key: 'r', ctrlKey: true, shiftKey: true })
    })
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
  })

  it('navigates when a nav item is selected', async () => {
    render(<Harness />)
    act(() => {
      useCommandPaletteStore.getState().setOpen(true)
    })
    const item = await screen.findByTestId('cmd-nav-tm')
    fireEvent.click(item)
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/tm')
    })
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('Ctrl+L opens quick lookup', () => {
    render(<Harness />)
    expect(useQuickLookupStore.getState().open).toBe(false)
    act(() => {
      fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    })
    expect(useQuickLookupStore.getState().open).toBe(true)
    expect(useQuickLookupStore.getState().prefill).toBe('')
  })

  it('Ctrl+L prefills quick lookup with the active selection', () => {
    render(<Harness />)
    const ta = document.createElement('textarea')
    ta.value = 'boa-fé objetiva'
    document.body.appendChild(ta)
    ta.focus()
    ta.setSelectionRange(0, 6) // "boa-fé"
    act(() => {
      fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    })
    expect(useQuickLookupStore.getState().prefill).toBe('boa-fé')
    document.body.removeChild(ta)
  })

  it('triggers global import dialog from the "Import file…" item', async () => {
    render(<Harness />)
    act(() => {
      useCommandPaletteStore.getState().setOpen(true)
    })
    const item = await screen.findByTestId('cmd-import')
    fireEvent.click(item)
    expect(useImportDialogStore.getState().open).toBe(true)
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })
})
