import type { CorpusTerm } from './types'

// Whole-word matching of installed corpus terms against a segment. Unlike the
// hand-curated glossary matcher (a regex per entry), corpora can hold tens of
// thousands of terms, so we build a token index once and only test the handful
// of candidate terms whose first word actually appears in the segment.

export interface CorpusHit {
  term: CorpusTerm
  start: number
  end: number
  // Which side of the term matched the source text, and the suggested rendering
  // (the opposite side).
  matchedSide: 'source' | 'target'
  suggestion: string
}

export interface CorpusIndex {
  // Lowercased first token -> terms whose keyed side starts with it.
  byFirstToken: Map<string, CorpusTerm[]>
  keySide: 'source' | 'target'
  minKeyLen: number
}

const WORD_RE = /[\p{L}\p{N}]+/gu

function firstToken(s: string): string | null {
  WORD_RE.lastIndex = 0
  const m = WORD_RE.exec(s.toLowerCase())
  return m ? m[0] : null
}

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[\p{L}\p{N}]/u.test(ch)
}

// Choose which side of the PT->EN corpus to match against, based on the project
// source language. PT source -> match the PT side; otherwise match the EN side.
export function keySideForSourceLang(
  sourceLangBase: string | undefined,
  termSourceLang: string,
): 'source' | 'target' {
  if (!sourceLangBase) return 'source'
  const termBase = termSourceLang.split('-')[0].toLowerCase()
  return sourceLangBase.split('-')[0].toLowerCase() === termBase ? 'source' : 'target'
}

export function buildCorpusIndex(
  terms: CorpusTerm[],
  keySide: 'source' | 'target',
  minKeyLen = 2,
): CorpusIndex {
  const byFirstToken = new Map<string, CorpusTerm[]>()
  for (const term of terms) {
    const key = keySide === 'source' ? term.source : term.target
    if (!key || key.trim().length < minKeyLen) continue
    const tok = firstToken(key)
    if (!tok) continue
    let bucket = byFirstToken.get(tok)
    if (!bucket) {
      bucket = []
      byFirstToken.set(tok, bucket)
    }
    bucket.push(term)
  }
  return { byFirstToken, keySide, minKeyLen }
}

export function findCorpusHits(
  source: string,
  index: CorpusIndex,
  opts: { limit: number },
): CorpusHit[] {
  if (!source || !source.trim() || index.byFirstToken.size === 0) return []
  const normalized = source.normalize('NFC')
  const lower = normalized.toLowerCase()
  const hits: CorpusHit[] = []
  const seen = new Set<string>()

  // Walk each word of the segment; for words that key a bucket, try the
  // candidate terms (longest first so multi-word terms win over their prefix).
  WORD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_RE.exec(lower)) !== null) {
    const bucket = index.byFirstToken.get(m[0])
    if (!bucket) continue
    const wordStart = m.index
    const candidates =
      bucket.length > 1
        ? [...bucket].sort((a, b) => keyLen(b, index.keySide) - keyLen(a, index.keySide))
        : bucket
    for (const term of candidates) {
      if (seen.has(term.id)) continue
      const key = (index.keySide === 'source' ? term.source : term.target)
        .normalize('NFC')
        .toLowerCase()
      if (!lower.startsWith(key, wordStart)) continue
      const end = wordStart + key.length
      // Whole-term boundary: no adjacent letter/number on either side.
      if (isWordChar(lower[wordStart - 1])) continue
      if (isWordChar(lower[end])) continue
      seen.add(term.id)
      hits.push({
        term,
        start: wordStart,
        end,
        matchedSide: index.keySide,
        suggestion: index.keySide === 'source' ? term.target : term.source,
      })
      if (hits.length >= opts.limit) {
        hits.sort((a, b) => a.start - b.start || b.end - a.end)
        return hits
      }
      // Candidates are sorted longest-first, so the first match at this word is
      // the longest; skip the remaining (shorter prefix) candidates here.
      break
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  return hits
}

function keyLen(term: CorpusTerm, side: 'source' | 'target'): number {
  return (side === 'source' ? term.source : term.target).length
}
