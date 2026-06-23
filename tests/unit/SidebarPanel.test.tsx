import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/storage/db'
import { SidebarPanel } from '@/features/editor/SidebarPanel'
import { useSidebarPanelStore } from '@/features/editor/useSidebarPanelStore'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'

beforeEach(async () => {
  await db.settings.clear()
  await db.tm.clear()
  await db.glossary.clear()
  useSidebarPanelStore.setState({ open: true, tab: 'tm' })
  useEditorModeStore.setState({ stage: 'translate', reviewMode: false, statusFilter: 'all' })
})

function renderPanel() {
  return render(
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
}

describe('SidebarPanel', () => {
  it('shows only the Translate stage tabs (TM, Glossary, MT) and no review/peers tabs', () => {
    renderPanel()
    expect(screen.getByTestId('sidebar-tab-tm')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-glossary')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-mt')).toBeInTheDocument()
    // QA/Spell/Changes belong to Revise; Peers moved to the header chip.
    expect(screen.queryByTestId('sidebar-tab-qa')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-tab-peers')).not.toBeInTheDocument()
  })

  it('shows the Revise stage tabs and the QA panel with no issues for an empty project', async () => {
    useEditorModeStore.setState({ stage: 'revise' })
    renderPanel()
    expect(screen.getByTestId('sidebar-tab-qa')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-tab-spell')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sidebar-tab-qa'))
    expect(await screen.findByTestId('qa-clean')).toBeInTheDocument()
  })

  it('switches to MT panel when MT tab clicked', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('sidebar-tab-mt'))
    expect(screen.getByTestId('mt-panel')).toBeInTheDocument()
  })

  it('falls back to the first stage tab when the stored tab is out of stage', () => {
    // Stored tab is 'qa' (a Revise tab) but stage is Translate → render TM, not QA.
    useSidebarPanelStore.setState({ tab: 'qa' })
    renderPanel()
    expect(screen.getByTestId('tm-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('qa-panel')).not.toBeInTheDocument()
  })
})
