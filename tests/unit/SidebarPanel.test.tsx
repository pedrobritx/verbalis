import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/storage/db'
import { SidebarPanel } from '@/features/editor/SidebarPanel'
import { useSidebarPanelStore } from '@/features/editor/useSidebarPanelStore'

beforeEach(async () => {
  await db.settings.clear()
  await db.tm.clear()
  await db.glossary.clear()
  useSidebarPanelStore.setState({ open: true, tab: 'tm' })
})

describe('SidebarPanel', () => {
  it('shows TM, Glossary, and MT tabs', () => {
    render(
      <MemoryRouter>
        <SidebarPanel
          focusedSource="hello"
          projectId="p"
          sourceLang="en"
          targetLang="es"
          onApplyTM={vi.fn()}
          onInsertGlossary={vi.fn()}
          onApplyMT={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('sidebar-tab-tm')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-glossary')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-mt')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-qa')).toBeInTheDocument()
  })

  it('shows the QA panel with no issues for an empty project', async () => {
    render(
      <MemoryRouter>
        <SidebarPanel
          focusedSource="hello"
          projectId="p"
          sourceLang="en"
          targetLang="es"
          onApplyTM={vi.fn()}
          onInsertGlossary={vi.fn()}
          onApplyMT={vi.fn()}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('sidebar-tab-qa'))
    expect(await screen.findByTestId('qa-clean')).toBeInTheDocument()
  })

  it('switches to MT panel when MT tab clicked', () => {
    render(
      <MemoryRouter>
        <SidebarPanel
          focusedSource="hello"
          projectId="p"
          sourceLang="en"
          targetLang="es"
          onApplyTM={vi.fn()}
          onInsertGlossary={vi.fn()}
          onApplyMT={vi.fn()}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('sidebar-tab-mt'))
    expect(screen.getByTestId('mt-panel')).toBeInTheDocument()
  })
})
