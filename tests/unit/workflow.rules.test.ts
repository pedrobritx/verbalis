import { describe, expect, it } from 'vitest'
import {
  workflowCapabilities,
  effectiveRoleStage,
  forcesSuggesting,
  type WorkflowStage,
} from '@/core/workflow/rules'
import type { ProjectRole, SegmentStatus } from '@/core/types'

const caps = (role: ProjectRole, stage: WorkflowStage, status: SegmentStatus = 'translated') =>
  workflowCapabilities(role, stage, status)

describe('workflowCapabilities — role × stage matrix (§5.2)', () => {
  it('project_manager manages and edits directly through translation and review', () => {
    for (const stage of ['translation', 'review'] as WorkflowStage[]) {
      expect(caps('project_manager', stage)).toEqual({
        canEditDirect: true,
        mustSuggest: false,
        canResolveChanges: true,
        canReview: true,
        canManage: true,
      })
    }
  })

  it('translator edits directly in translation, and is forced to suggest in review', () => {
    const t = caps('translator', 'translation')
    expect(t.canEditDirect).toBe(true)
    expect(t.mustSuggest).toBe(false)
    expect(t.canResolveChanges).toBe(false)
    expect(t.canReview).toBe(false)

    const r = caps('translator', 'review')
    expect(r.canEditDirect).toBe(false)
    expect(r.mustSuggest).toBe(true)
  })

  it('a translator must suggest on an already-reviewed segment even in translation', () => {
    const c = caps('translator', 'translation', 'reviewed')
    expect(c.canEditDirect).toBe(false)
    expect(c.mustSuggest).toBe(true)
  })

  it('revisor waits during translation, then edits + resolves during review', () => {
    const t = caps('revisor', 'translation')
    expect(t).toMatchObject({ canEditDirect: false, mustSuggest: false, canResolveChanges: true })

    const r = caps('revisor', 'review')
    expect(r).toMatchObject({ canEditDirect: true, mustSuggest: false, canResolveChanges: true, canReview: true })
    expect(r.canManage).toBe(false)
  })

  it('only revisor and project_manager can accept/reject changes', () => {
    expect(caps('translator', 'review').canResolveChanges).toBe(false)
    expect(caps('revisor', 'review').canResolveChanges).toBe(true)
    expect(caps('project_manager', 'review').canResolveChanges).toBe(true)
  })

  it('final stage is locked to everyone but a manager', () => {
    for (const role of ['translator', 'revisor'] as ProjectRole[]) {
      const c = caps(role, 'final')
      expect(c.canEditDirect).toBe(false)
      expect(c.mustSuggest).toBe(false)
    }
    expect(caps('project_manager', 'final').canEditDirect).toBe(true)
  })
})

describe('effectiveRoleStage — local-only is PM-of-self', () => {
  it('grants a manager in translation with no cloud link (zero regression)', () => {
    expect(effectiveRoleStage(undefined)).toEqual({ role: 'project_manager', stage: 'translation' })
    const c = workflowCapabilities('project_manager', 'translation', 'draft')
    expect(c).toMatchObject({ canEditDirect: true, canResolveChanges: true, canManage: true, mustSuggest: false })
  })

  it('reads a cloud project’s role and defaults the stage to translation', () => {
    expect(effectiveRoleStage({ role: 'translator' })).toEqual({ role: 'translator', stage: 'translation' })
    expect(effectiveRoleStage({ role: 'revisor', stage: 'review' })).toEqual({ role: 'revisor', stage: 'review' })
  })
})

describe('forcesSuggesting', () => {
  it('is true only for a translator in the review stage', () => {
    expect(forcesSuggesting('translator', 'review')).toBe(true)
    expect(forcesSuggesting('translator', 'translation')).toBe(false)
    expect(forcesSuggesting('revisor', 'review')).toBe(false)
    expect(forcesSuggesting('project_manager', 'review')).toBe(false)
  })
})
