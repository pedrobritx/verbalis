export type QACode =
  | 'empty_target'
  | 'tag_mismatch'
  | 'number_mismatch'
  | 'term_inconsistency'
  | 'repeated_inconsistent'
  | 'leading_trailing_ws'
  | 'double_space'
  | 'space_before_punct'
  | 'repeated_word'
  | 'straight_quotes'

export type QASeverity = 'error' | 'warning'

export interface QAIssue {
  /** Segment the issue was found on. */
  segmentId: string
  /** 0-based position of the segment within the project, for jump-to. */
  index: number
  code: QACode
  severity: QASeverity
  message: string
}

export type QARuleToggles = Record<QACode, boolean>

export interface QAOptions {
  /** Target language tag, used to pick the relevant glossary translation. */
  targetLang: string
  /** Per-rule enable flags. Omitted rules default to enabled. */
  rules?: Partial<QARuleToggles>
}

export const QA_CODES: QACode[] = [
  'empty_target',
  'tag_mismatch',
  'number_mismatch',
  'term_inconsistency',
  'repeated_inconsistent',
  'leading_trailing_ws',
  'double_space',
  'space_before_punct',
  'repeated_word',
  'straight_quotes',
]

export const QA_RULE_LABELS: Record<QACode, string> = {
  empty_target: 'Empty target',
  tag_mismatch: 'Tag mismatch',
  number_mismatch: 'Number mismatch',
  term_inconsistency: 'Terminology not applied',
  repeated_inconsistent: 'Inconsistent repeated segment',
  leading_trailing_ws: 'Leading/trailing whitespace',
  double_space: 'Double space',
  space_before_punct: 'Space before punctuation',
  repeated_word: 'Repeated word',
  straight_quotes: 'Straight quotes',
}

export const DEFAULT_QA_RULES: QARuleToggles = {
  empty_target: true,
  tag_mismatch: true,
  number_mismatch: true,
  term_inconsistency: true,
  repeated_inconsistent: true,
  leading_trailing_ws: true,
  double_space: true,
  space_before_punct: true,
  repeated_word: true,
  straight_quotes: false,
}
