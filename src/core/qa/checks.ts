import type { GlossaryEntry, Segment } from '@/core/types'
import { normalize } from '@/core/tm/similarity'
import { findGlossaryHits } from '@/core/glossary/match'
import { extractNumbers, sameNumberMultiset } from '@/core/numbers'
import { groupByNormalizedSource } from '@/core/segments/repetition'
import {
  DEFAULT_QA_RULES,
  type QACode,
  type QAIssue,
  type QAOptions,
  type QARuleToggles,
} from './types'

/** Inline-tag placeholders look like `{1}`, `{2}` (see BilingualSegmentMeta.inlineTags). */
function extractPlaceholders(text: string): string[] {
  return text.match(/\{\d+\}/g) ?? []
}

function multiset(items: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1)
  return m
}

function sameStringMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const ma = multiset(a)
  const mb = multiset(b)
  if (ma.size !== mb.size) return false
  for (const [k, v] of ma) if (mb.get(k) !== v) return false
  return true
}

/** A segment carries a target the translator has worked on. */
function hasTarget(seg: Segment): boolean {
  return seg.target.trim().length > 0
}

/**
 * Run all enabled QA rules over a project's segments. Pure and synchronous —
 * the caller supplies the segments (in project order) and the glossary entries
 * that apply to the project. Inspired by memoQ's QA (tags, numbers, terminology
 * consistency) but limited to checks that are reliable without a server.
 */
export function runQA(segments: Segment[], glossary: GlossaryEntry[], opts: QAOptions): QAIssue[] {
  const rules: QARuleToggles = { ...DEFAULT_QA_RULES, ...(opts.rules ?? {}) }
  const issues: QAIssue[] = []
  const push = (seg: Segment, code: QACode, severity: QAIssue['severity'], message: string) => {
    issues.push({ segmentId: seg.id, index: seg.index, code, severity, message })
  }

  segments.forEach((seg) => {
    const target = seg.target

    if (rules.empty_target && seg.status !== 'untranslated' && target.trim() === '') {
      push(
        seg,
        'empty_target',
        'error',
        'Target is empty but the segment is not marked untranslated.',
      )
    }

    // Tag / number / whitespace checks only make sense once a target exists.
    if (!hasTarget(seg)) return

    if (rules.tag_mismatch) {
      const srcTags = extractPlaceholders(seg.source)
      const tgtTags = extractPlaceholders(target)
      if (!sameStringMultiset(srcTags, tgtTags)) {
        push(
          seg,
          'tag_mismatch',
          'error',
          `Tags differ: source has ${srcTags.length ? srcTags.join(' ') : 'none'}, target has ${tgtTags.length ? tgtTags.join(' ') : 'none'}.`,
        )
      }
    }

    if (rules.number_mismatch) {
      const srcNums = extractNumbers(seg.source)
      const tgtNums = extractNumbers(target)
      if (!sameNumberMultiset(srcNums, tgtNums)) {
        push(
          seg,
          'number_mismatch',
          'error',
          `Numbers differ: source has [${srcNums.join(', ')}], target has [${tgtNums.join(', ')}].`,
        )
      }
    }

    if (rules.leading_trailing_ws) {
      const srcTrimDiff = seg.source !== seg.source.trim()
      const tgtTrimDiff = target !== target.trim()
      if (tgtTrimDiff && !srcTrimDiff) {
        push(seg, 'leading_trailing_ws', 'warning', 'Target has leading or trailing whitespace.')
      }
    }

    if (rules.double_space && /\S {2,}\S/.test(target)) {
      push(seg, 'double_space', 'warning', 'Target contains a double space.')
    }

    if (rules.space_before_punct) {
      // French legitimately uses a space before ; : ? ! — only flag the comma
      // and period there; flag the whole set for every other language.
      const isFrench = opts.targetLang.toLowerCase().startsWith('fr')
      const re = isFrench ? /\s[,.]/ : /\s[,.;:?!]/
      if (re.test(target)) {
        push(seg, 'space_before_punct', 'warning', 'Target has a space before punctuation.')
      }
    }

    if (rules.repeated_word && /\b(\p{L}{2,})\s+\1\b/iu.test(target)) {
      push(seg, 'repeated_word', 'warning', 'Target repeats a word back-to-back.')
    }

    if (rules.straight_quotes && /["]/.test(target)) {
      push(
        seg,
        'straight_quotes',
        'warning',
        'Target uses straight quotes ("); consider typographic quotes (“ ”).',
      )
    }

    if (rules.term_inconsistency && glossary.length > 0) {
      const hits = findGlossaryHits(seg.source, glossary, { limit: 50 })
      const normTarget = normalize(target)
      for (const hit of hits) {
        const expected = hit.entry.translations[opts.targetLang]
        if (!expected || !expected.trim()) continue
        if (!normTarget.includes(normalize(expected))) {
          push(
            seg,
            'term_inconsistency',
            'warning',
            `Glossary term “${hit.entry.term}” → “${expected}” not found in target.`,
          )
        }
      }
    }
  })

  if (rules.repeated_inconsistent) {
    for (const group of groupByNormalizedSource(segments).values()) {
      const translated = group.filter(hasTarget)
      if (translated.length < 2) continue
      const distinct = new Set(translated.map((s) => normalize(s.target)))
      if (distinct.size > 1) {
        for (const seg of translated) {
          push(
            seg,
            'repeated_inconsistent',
            'warning',
            'This source repeats elsewhere but is translated differently.',
          )
        }
      }
    }
  }

  issues.sort((a, b) => a.index - b.index)
  return issues
}
