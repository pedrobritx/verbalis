import { beforeEach, describe, expect, it } from 'vitest'
import { runQA } from '@/core/qa/checks'
import { DEFAULT_QA_RULES } from '@/core/qa/types'
import { effectiveQaRules, isQaRuleEnabled } from '@/core/qa/registryRules'
import { extensionRegistry } from '@/core/extensions/registry'
import { registerBuiltinExtensions, __resetBuiltinsForTest } from '@/core/extensions/builtins'
import type { Segment } from '@/core/types'

function seg(target: string): Segment {
  const now = new Date().toISOString()
  return {
    id: 's1',
    projectId: 'p1',
    index: 0,
    source: 'src',
    target,
    status: 'translated',
    createdAt: now,
    updatedAt: now,
  }
}

describe('effectiveQaRules (registry-gated QA, §6.2)', () => {
  beforeEach(() => {
    extensionRegistry.__resetForTest()
    __resetBuiltinsForTest()
  })

  it('falls back to all-on when no QA manifests are registered (keeps runQA pure)', () => {
    // Nothing registered → every rule treated as enabled, toggles pass through.
    expect(isQaRuleEnabled('double_space')).toBe(true)
    expect(effectiveQaRules({ double_space: true })).toEqual({ double_space: true })
  })

  it('forces a rule off when its addon is disabled, keeping the others', () => {
    registerBuiltinExtensions()
    extensionRegistry.setEnabled('qa.double_space', false)

    expect(isQaRuleEnabled('double_space')).toBe(false)
    const effective = effectiveQaRules({ double_space: true, repeated_word: true })
    expect(effective.double_space).toBe(false)
    expect(effective.repeated_word).toBe(true)
  })

  it('disabling the QA addon removes the finding from runQA output (the DoD)', () => {
    registerBuiltinExtensions()
    const segments = [seg('hello  world')] // double space

    // Enabled: the double_space rule fires.
    let issues = runQA(segments, [], {
      targetLang: 'en',
      rules: effectiveQaRules(DEFAULT_QA_RULES),
    })
    expect(issues.some((i) => i.code === 'double_space')).toBe(true)

    // Disable the addon → the finding is gone, others unaffected.
    extensionRegistry.setEnabled('qa.double_space', false)
    issues = runQA(segments, [], { targetLang: 'en', rules: effectiveQaRules(DEFAULT_QA_RULES) })
    expect(issues.some((i) => i.code === 'double_space')).toBe(false)
  })
})
