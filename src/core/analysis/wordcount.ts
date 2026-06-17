// Locale-aware word/character counting. Uses Intl.Segmenter (granularity
// 'word') when available so CJK and other space-less scripts count correctly,
// falling back to whitespace splitting otherwise. Intl.Segmenter isn't in the
// project's TS lib, so we declare the minimal shape we use here.

interface SegmentDatum {
  segment: string
  isWordLike?: boolean
}
interface SegmenterLike {
  segment(input: string): Iterable<SegmentDatum>
}
interface SegmenterCtor {
  new (
    locales?: string | string[],
    options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
  ): SegmenterLike
}

const SegmenterImpl: SegmenterCtor | undefined =
  typeof Intl !== 'undefined'
    ? (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
    : undefined

const segmenterCache = new Map<string, SegmenterLike | null>()

function getWordSegmenter(lang?: string): SegmenterLike | null {
  const key = lang ?? ''
  const cached = segmenterCache.get(key)
  if (cached !== undefined) return cached
  let seg: SegmenterLike | null = null
  if (SegmenterImpl) {
    try {
      seg = new SegmenterImpl(lang || undefined, { granularity: 'word' })
    } catch {
      seg = null
    }
  }
  segmenterCache.set(key, seg)
  return seg
}

export function countWords(text: string, lang?: string): number {
  const t = text.trim()
  if (!t) return 0
  const seg = getWordSegmenter(lang)
  if (seg) {
    let n = 0
    for (const part of seg.segment(t)) {
      if (part.isWordLike) n += 1
    }
    return n
  }
  return t.split(/\s+/).filter(Boolean).length
}

export function countChars(text: string, opts: { includeWhitespace?: boolean } = {}): number {
  const source = opts.includeWhitespace ? text : text.replace(/\s+/g, '')
  // Spread to count by code point, so surrogate-pair characters count as one.
  return [...source].length
}
