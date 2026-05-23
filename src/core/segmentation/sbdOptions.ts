import sbd from 'sbd'

const SBD_OPTIONS = {
  newline_boundaries: false,
  html_boundaries: false,
  sanitize: false,
  allowed_tags: false,
  preserve_whitespace: false,
} as const

export function splitSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const sentences = sbd.sentences(trimmed, SBD_OPTIONS).map((s) => s.trim()).filter(Boolean)
  return sentences.length > 0 ? sentences : [trimmed]
}
