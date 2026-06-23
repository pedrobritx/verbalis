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
  localStorage.clear()
  const store = useSidebarPanelStore.getState()
  useSidebarPanelStore.setState({ open: true, tab: 'tm', collapsed: {} })
  store.resetLayout('prepare')
  store.resetLayout('translate')
  store.resetLayout('revise')
  useEditorModeStore.setState({ stage: 'translate', reviewMode: false, statusFilter: 'all' })
})

function renderPanel() {
  return render(
    <MemoryRouter>
      <SidebarPanel
        focusedSource="hello"
        focusedTarget={undefined}
        focusedSegmentId={undefined}
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

describe('SidebarPanel (multi-pane)', () => {
  it('stacks the Translate stage panels (TM, Glossary, MT, Lookup) and hides review panels', () => {
    renderPanel()
    expect(screen.getByTestId('sidebar-section-tm')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-section-glossary')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-section-mt')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-section-lookup')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-section-qa')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-section-peers')).not.toBeInTheDocument()
  })

  it('shows the Revise stage panels and renders QA clean for an empty project', async () => {
    useEditorModeStore.setState({ stage: 'revise' })
    renderPanel()
    expect(screen.getByTestId('sidebar-section-qa')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-section-spell')).toBeInTheDocument()
    // QA panel is in the layout and expanded, so it runs without a tab click.
    expect(await screen.findByTestId('qa-clean')).toBeInTheDocument()
  })

  it('collapses a panel body without removing the section', () => {
    renderPanel()
    expect(screen.getByTestId('tm-panel').querySelector('.p-3')).toBeTruthy()
    fireEvent.click(screen.getByTestId('sidebar-collapse-tm'))
    // Header stays; body is gone.
    expect(screen.getByTestId('sidebar-section-tm')).toBeInTheDocument()
    expect(screen.queryByTestId('tm-panel-body')).not.toBeInTheDocument()
  })

  it('removes a panel from the active stage via the section close button', () => {
    renderPanel()
    expect(screen.getByTestId('sidebar-section-mt')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sidebar-remove-mt'))
    expect(screen.queryByTestId('sidebar-section-mt')).not.toBeInTheDocument()
    // Removal is scoped to the stage layout.
    expect(useSidebarPanelStore.getState().layout.translate).not.toContain('mt')
  })

  it('adds a panel through the customizer and persists per-stage', () => {
    // Start by removing glossary, then re-add it via the customizer menu.
    useSidebarPanelStore.getState().togglePanel('translate', 'glossary')
    renderPanel()
    expect(screen.queryByTestId('sidebar-section-glossary')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sidebar-customize'))
    fireEvent.click(screen.getByTestId('sidebar-customize-glossary'))
    expect(screen.getByTestId('sidebar-section-glossary')).toBeInTheDocument()
    expect(useSidebarPanelStore.getState().layout.translate).toContain('glossary')
  })

  it('reorders panels within a stage', () => {
    const before = [...useSidebarPanelStore.getState().layout.translate]
    useSidebarPanelStore.getState().movePanel('translate', before[1], -1)
    const after = useSidebarPanelStore.getState().layout.translate
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
  })

  it('lists active tools in the customizer in the same order as the sidebar', () => {
    useSidebarPanelStore.setState({
      layout: {
        ...useSidebarPanelStore.getState().layout,
        translate: ['mt', 'tm', 'glossary', 'lookup'],
      },
    })
    renderPanel()
    fireEvent.click(screen.getByTestId('sidebar-customize'))
    // The move-up control renders only for active tools, in layout order.
    const activeOrder = screen
      .getAllByTestId(/^sidebar-moveup-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(activeOrder).toEqual([
      'sidebar-moveup-mt',
      'sidebar-moveup-tm',
      'sidebar-moveup-glossary',
      'sidebar-moveup-lookup',
    ])
  })

  it('keeps stage layouts independent', () => {
    useSidebarPanelStore.getState().togglePanel('translate', 'mt')
    expect(useSidebarPanelStore.getState().layout.translate).not.toContain('mt')
    // Revise layout is untouched (it never had mt anyway, but prove isolation).
    expect(useSidebarPanelStore.getState().layout.revise).toEqual(
      expect.arrayContaining(['qa', 'spell', 'changes', 'history']),
    )
  })
})
