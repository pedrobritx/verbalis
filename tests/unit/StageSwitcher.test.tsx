import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StageSwitcher } from '@/features/editor/StageSwitcher'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'

beforeEach(() => {
  cleanup()
  useEditorModeStore.setState({ stage: 'translate', reviewMode: false, statusFilter: 'all' })
})

describe('StageSwitcher', () => {
  it('renders the three stages with Translate selected by default', () => {
    render(<StageSwitcher />)
    expect(screen.getByTestId('stage-prepare')).toBeInTheDocument()
    expect(screen.getByTestId('stage-translate')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stage-revise')).toHaveAttribute('aria-selected', 'false')
  })

  it('switching to Revise enables review mode and the translated filter', () => {
    render(<StageSwitcher />)
    fireEvent.click(screen.getByTestId('stage-revise'))
    const s = useEditorModeStore.getState()
    expect(s.stage).toBe('revise')
    expect(s.reviewMode).toBe(true)
    expect(s.statusFilter).toBe('translated')
    expect(screen.getByTestId('stage-revise')).toHaveAttribute('aria-selected', 'true')
  })

  it('switching to Prepare snaps the filter to untranslated', () => {
    render(<StageSwitcher />)
    fireEvent.click(screen.getByTestId('stage-prepare'))
    expect(useEditorModeStore.getState().stage).toBe('prepare')
    expect(useEditorModeStore.getState().statusFilter).toBe('untranslated')
  })
})
