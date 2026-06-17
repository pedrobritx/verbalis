import { describe, expect, it } from 'vitest'
import { runQA } from '@/core/qa/checks'
import type { GlossaryEntry, Segment, SegmentStatus } from '@/core/types'

let counter = 0
function seg(
  source: string,
  target: string,
  status: SegmentStatus = 'translated',
  index = counter++,
): Segment {
  return {
    id: `s${index}`,
    projectId: 'p1',
    index,
    source,
    target,
    status,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

const OPTS = { targetLang: 'es' }

describe('runQA', () => {
  it('flags an empty target on a non-untranslated segment', () => {
    const issues = runQA([seg('hello', '', 'draft')], [], OPTS)
    expect(issues.some((i) => i.code === 'empty_target')).toBe(true)
  })

  it('does not flag empty target when status is untranslated', () => {
    const issues = runQA([seg('hello', '', 'untranslated')], [], OPTS)
    expect(issues.some((i) => i.code === 'empty_target')).toBe(false)
  })

  it('flags a tag mismatch (missing placeholder)', () => {
    const issues = runQA([seg('Click {1}here{2}', 'Haz clic aquí')], [], OPTS)
    expect(issues.some((i) => i.code === 'tag_mismatch' && i.severity === 'error')).toBe(true)
  })

  it('passes when tags are preserved (any order)', () => {
    const issues = runQA([seg('Click {1}here{2}', '{1}Haz{2} clic')], [], OPTS)
    expect(issues.some((i) => i.code === 'tag_mismatch')).toBe(false)
  })

  it('flags a number mismatch', () => {
    const issues = runQA([seg('Total: 50', 'Total: 7676')], [], OPTS)
    expect(issues.some((i) => i.code === 'number_mismatch')).toBe(true)
  })

  it('treats Arabic-Indic numerals of equal value as consistent', () => {
    const issues = runQA([seg('Total 50', 'المجموع ٥٠')], [], { targetLang: 'ar' })
    expect(issues.some((i) => i.code === 'number_mismatch')).toBe(false)
  })

  it('flags terminology that was not applied', () => {
    const glossary: GlossaryEntry[] = [
      { id: 'g1', term: 'invoice', definition: '', translations: { es: 'factura' } },
    ]
    const issues = runQA([seg('the invoice total', 'el monto del documento')], glossary, OPTS)
    expect(issues.some((i) => i.code === 'term_inconsistency')).toBe(true)
  })

  it('does not flag terminology when the expected translation is present', () => {
    const glossary: GlossaryEntry[] = [
      { id: 'g1', term: 'invoice', definition: '', translations: { es: 'factura' } },
    ]
    const issues = runQA([seg('the invoice total', 'el total de la factura')], glossary, OPTS)
    expect(issues.some((i) => i.code === 'term_inconsistency')).toBe(false)
  })

  it('flags inconsistent repeated segments', () => {
    const segments = [
      seg('Strongly agree', 'Muy de acuerdo'),
      seg('Strongly agree', 'Totalmente en desacuerdo'),
    ]
    const issues = runQA(segments, [], OPTS)
    expect(issues.filter((i) => i.code === 'repeated_inconsistent')).toHaveLength(2)
  })

  it('respects per-rule toggles', () => {
    const issues = runQA([seg('Total: 50', 'Total: 99')], [], {
      ...OPTS,
      rules: { number_mismatch: false },
    })
    expect(issues.some((i) => i.code === 'number_mismatch')).toBe(false)
  })

  it('sorts issues by segment index', () => {
    const segments = [seg('a', 'a', 'translated', 5), seg('Total 1', 'Total 2', 'translated', 2)]
    const issues = runQA(segments, [], OPTS)
    expect(issues[0].index).toBeLessThanOrEqual(issues[issues.length - 1].index)
  })
})
