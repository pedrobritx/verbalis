// Pure case transforms applied to a text selection by the rich editor. Kept
// dependency-free and Unicode-aware so they behave on accented PT/EN text.

export type CaseTransform = 'upper' | 'lower' | 'title' | 'sentence'

export const CASE_LABELS: Record<CaseTransform, string> = {
  upper: 'UPPERCASE',
  lower: 'lowercase',
  title: 'Title Case',
  sentence: 'Sentence case',
}

const WORD_RE = /\p{L}[\p{L}\p{M}'’-]*/gu
const SENTENCE_START_RE = /(^\s*\p{L})|([.!?]["'”’)\]]?\s+\p{L})/gu

function toTitleCase(text: string): string {
  return text.replace(WORD_RE, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function toSentenceCase(text: string): string {
  return text.toLowerCase().replace(SENTENCE_START_RE, (m) => m.toUpperCase())
}

export function transformCase(text: string, mode: CaseTransform): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase()
    case 'lower':
      return text.toLowerCase()
    case 'title':
      return toTitleCase(text)
    case 'sentence':
      return toSentenceCase(text)
  }
}
