import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorModeStore } from '@/features/editor/useEditorModeStore'

describe('useEditorModeStore', () => {
  beforeEach(() => {
    useEditorModeStore.setState({ reviewMode: false, statusFilter: 'all' })
  })

  it('starts with review mode off and filter "all"', () => {
    const s = useEditorModeStore.getState()
    expect(s.reviewMode).toBe(false)
    expect(s.statusFilter).toBe('all')
  })

  it('toggleReviewMode flips the flag', () => {
    useEditorModeStore.getState().toggleReviewMode()
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
    useEditorModeStore.getState().toggleReviewMode()
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
  })

  it('setReviewMode sets exact value', () => {
    useEditorModeStore.getState().setReviewMode(true)
    expect(useEditorModeStore.getState().reviewMode).toBe(true)
    useEditorModeStore.getState().setReviewMode(false)
    expect(useEditorModeStore.getState().reviewMode).toBe(false)
  })

  it('setStatusFilter narrows the filter', () => {
    useEditorModeStore.getState().setStatusFilter('reviewed')
    expect(useEditorModeStore.getState().statusFilter).toBe('reviewed')
    useEditorModeStore.getState().setStatusFilter('all')
    expect(useEditorModeStore.getState().statusFilter).toBe('all')
  })
})
