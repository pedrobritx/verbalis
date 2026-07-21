import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AddonsPage from '@/features/addons/AddonsPage'
import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions, __resetBuiltinsForTest } from '@/core/extensions/builtins'

describe('AddonsPage (§6.2)', () => {
  beforeEach(() => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
    registerBuiltinExtensions()
  })

  it('lists everything pluggable: MT providers, QA rules, formats, connectors', () => {
    render(<AddonsPage />)
    // A section per kind.
    expect(screen.getByTestId('addons-section-mt-provider')).toBeInTheDocument()
    expect(screen.getByTestId('addons-section-qa-rule')).toBeInTheDocument()
    expect(screen.getByTestId('addons-section-import-format')).toBeInTheDocument()
    expect(screen.getByTestId('addons-section-storage-connector')).toBeInTheDocument()
    // Representative entries of each kind.
    expect(screen.getByTestId('addon-mt.claude')).toBeInTheDocument()
    expect(screen.getByTestId('addon-qa.double_space')).toBeInTheDocument()
    expect(screen.getByTestId('addon-format.xliff')).toBeInTheDocument()
    expect(screen.getByTestId('addon-connector.gdrive')).toBeInTheDocument()
    expect(screen.getByTestId('addon-connector.onedrive')).toBeInTheDocument()
  })

  it('the storage connectors are toggleable', () => {
    render(<AddonsPage />)
    const gdrive = screen.getByTestId('addon-toggle-connector.gdrive') as HTMLInputElement
    expect(gdrive.checked).toBe(true)
    fireEvent.click(gdrive)
    expect(extensionRegistry.isEnabled('connector.gdrive')).toBe(false)

    const onedrive = screen.getByTestId('addon-toggle-connector.onedrive') as HTMLInputElement
    expect(onedrive.checked).toBe(true)
    fireEvent.click(onedrive)
    expect(extensionRegistry.isEnabled('connector.onedrive')).toBe(false)
  })

  it('toggling a QA addon flips its registry enablement', () => {
    render(<AddonsPage />)
    const toggle = screen.getByTestId('addon-toggle-qa.double_space') as HTMLInputElement
    expect(toggle.checked).toBe(true)

    fireEvent.click(toggle)
    expect(extensionRegistry.isEnabled('qa.double_space')).toBe(false)
    expect((screen.getByTestId('addon-toggle-qa.double_space') as HTMLInputElement).checked).toBe(false)

    fireEvent.click(screen.getByTestId('addon-toggle-qa.double_space'))
    expect(extensionRegistry.isEnabled('qa.double_space')).toBe(true)
  })

  it('formats are shown as always-on (no toggle)', () => {
    render(<AddonsPage />)
    expect(screen.getByTestId('addon-builtin-format.xliff')).toBeInTheDocument()
    expect(screen.queryByTestId('addon-toggle-format.xliff')).toBeNull()
  })
})
