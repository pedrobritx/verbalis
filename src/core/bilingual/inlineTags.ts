// Pure helpers for XLIFF inline tags. Inline tags are round-tripped as opaque
// numeric placeholders — `{1}`, `{2}` — in the plain `source`/`target` text, with
// the original XML kept in `Segment.bilingualMeta.inlineTags` (see
// `src/core/bilingual/xliff12.ts`). These helpers are headless and dependency-free
// so the rich editor (which renders each placeholder as a chip) and the read-only
// source renderer share one source of truth, and so they stay unit-testable.

export type InlineTagKind = 'generic' | 'quote' | 'footnote' | 'biblio'

/** How each kind is shown on a chip: an optional leading glyph plus a label. */
export const TAG_KIND_PRESENTATION: Record<InlineTagKind, { glyph: string; label: string }> = {
  generic: { glyph: '', label: 'Tag' },
  quote: { glyph: '❝', label: 'Quote' },
  footnote: { glyph: '¹', label: 'Footnote' },
  biblio: { glyph: '※', label: 'Bibliography' },
}

const PLACEHOLDER_RE = /\{(\d+)\}/g

export type TagTextPart = { type: 'text'; value: string } | { type: 'tag'; id: string }

/**
 * Split a placeholder-carrying string into ordered text and tag parts. The
 * inverse of joining parts back with `{id}`; used to seed the editor and to
 * render the read-only source cell with chips.
 */
export function splitTextWithTags(text: string): TagTextPart[] {
  const parts: TagTextPart[] = []
  let last = 0
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push({ type: 'text', value: text.slice(last, idx) })
    parts.push({ type: 'tag', id: m[1] })
    last = idx + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

/** Ordered placeholder ids appearing in a string (with repeats). */
export function listTagIds(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1])
}

/**
 * The lowest source tag still missing from the target, in source order and
 * multiset-aware (so a tag the source uses twice is only satisfied by two in the
 * target). Drives the "insert next tag" keystroke (memoQ's F9). Returns null when
 * the target already carries every source tag.
 */
export function nextMissingTagId(source: string, target: string): string | null {
  const targetCounts = new Map<string, number>()
  for (const id of listTagIds(target)) {
    targetCounts.set(id, (targetCounts.get(id) ?? 0) + 1)
  }
  const consumed = new Map<string, number>()
  for (const id of listTagIds(source)) {
    const available = targetCounts.get(id) ?? 0
    const used = consumed.get(id) ?? 0
    if (used >= available) return id
    consumed.set(id, used + 1)
  }
  return null
}

/** Best-effort classification of an inline tag from its original XML payload. */
export function classifyInlineTagKind(xml?: string): InlineTagKind {
  const x = (xml ?? '').toLowerCase()
  if (!x) return 'generic'
  if (/footnote|endnote|x-?fn|ctype=["']?x?-?footnote/.test(x)) return 'footnote'
  if (/bibl|citation|\bcite\b/.test(x)) return 'biblio'
  if (/quot|[«»“”„‟]/.test(x)) return 'quote'
  return 'generic'
}

/** Classification plus its presentation, for convenience at chip-creation time. */
export function classifyInlineTag(xml?: string): {
  kind: InlineTagKind
  glyph: string
  label: string
} {
  const kind = classifyInlineTagKind(xml)
  return { kind, ...TAG_KIND_PRESENTATION[kind] }
}
