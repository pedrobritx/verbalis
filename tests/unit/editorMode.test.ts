import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'

describe('useEditorModeStore', () => {
  beforeEach(() => {
    useEditorModeStore.setState({ stage: 'translate', reviewMode: false, statusFilter: 'all' })
  })

  it('starts in the translate stage with review off and filter "all"', () => {
    const s = useEditorModeStore.getState()
    expect(s.stage).toBe('translate')
    expect(s.reviewMode).toBe(false)
    expect(s.statusFilter).toBe('all')
  })

  it('setStage updates stage, mirrors reviewMode, and applies the smart filter', () => {
    useEditorModeStore.getState().setStage('prepare')
    expect(useEditorModeStore.getState().stage).toBe('prepare')
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
    expect(useEditorModeStore.getState().statusFilter).toBe('untranslated')

    useEditorModeStore.getState().setStage('revise')
    expect(useEditorModeStore.getState().stage).toBe('revise')
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
    expect(useEditorModeStore.getState().statusFilter).toBe('translated')

    useEditorModeStore.getState().setStage('translate')
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
    expect(useEditorModeStore.getState().statusFilter).toBe('all')
  })

  it('toggleReviewMode flips between the translate and revise stages', () => {
    useEditorModeStore.getState().toggleReviewMode()
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
    expect(useEditorModeStore.getState().stage).toBe('revise')
    useEditorModeStore.getState().toggleReviewMode()
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
    expect(useEditorModeStore.getState().stage).toBe('translate')
  })

  it('setReviewMode maps to the revise/translate stages', () => {
    useEditorModeStore.getState().setReviewMode(true)
    expect(useEditorModeStore.getState().stage).toBe('revise')
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
    useEditorModeStore.getState().setReviewMode(false)
    expect(useEditorModeStore.getState().stage).toBe('translate')
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
  })

  it('setStatusFilter narrows the filter without touching the stage', () => {
    useEditorModeStore.getState().setStatusFilter('reviewed')
    expect(useEditorModeStore.getState().statusFilter).toBe('reviewed')
    expect(useEditorModeStore.getState().stage).toBe('translate')
    useEditorModeStore.getState().setStatusFilter('all')
    expect(useEditorModeStore.getState().statusFilter).toBe('all')
  })
})
