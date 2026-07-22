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

  it('flags a space before punctuation', () => {
    const issues = runQA([seg('hello ,world', 'hola ,mundo')], [], OPTS)
    expect(issues.some((i) => i.code === 'space_before_punct')).toBe(true)
  })

  it('does not flag clean punctuation', () => {
    const issues = runQA([seg('hello, world', 'hola, mundo')], [], OPTS)
    expect(issues.some((i) => i.code === 'space_before_punct')).toBe(false)
  })

  it('allows a space before ; : ? ! for French targets but still flags the comma', () => {
    const fr = { targetLang: 'fr-FR' }
    expect(
      runQA([seg('a', 'Bonjour ; toi')], [], fr).some((i) => i.code === 'space_before_punct'),
    ).toBe(false)
    expect(
      runQA([seg('a', 'Bonjour ,toi')], [], fr).some((i) => i.code === 'space_before_punct'),
    ).toBe(true)
  })

  it('flags a back-to-back repeated word', () => {
    const issues = runQA([seg('the cat', 'the the cat')], [], OPTS)
    expect(issues.some((i) => i.code === 'repeated_word')).toBe(true)
  })

  it('does not flag distinct adjacent words', () => {
    const issues = runQA([seg('the cat', 'the cat sat')], [], OPTS)
    expect(issues.some((i) => i.code === 'repeated_word')).toBe(false)
  })

  it('flags straight quotes only when the rule is enabled', () => {
    const target = 'she said "hi"'
    expect(runQA([seg('a', target)], [], OPTS).some((i) => i.code === 'straight_quotes')).toBe(
      false,
    )
    expect(
      runQA([seg('a', target)], [], { ...OPTS, rules: { straight_quotes: true } }).some(
        (i) => i.code === 'straight_quotes',
      ),
    ).toBe(true)
  })

  it('sorts issues by segment index', () => {
    const segments = [seg('a', 'a', 'translated', 5), seg('Total 1', 'Total 2', 'translated', 2)]
    const issues = runQA(segments, [], OPTS)
    expect(issues[0].index).toBeLessThanOrEqual(issues[issues.length - 1].index)
  })
})
