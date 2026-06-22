// Split target text into checkable word tokens for spell-checking. Headless and
// pure so it is unit-tested directly and shared by the panel and the (later)
// rich-editor squiggle overlay, which both need exact character offsets.
//
// Strategy: split on whitespace into raw chunks, drop whole chunks a dictionary
// shouldn't judge (inline-tag placeholders `{1}`, anything with a digit,
// URLs/emails), then pull letter runs out of the rest — keeping internal
// apostrophes/hyphens (don't, e-mail) and dropping all-caps acronyms.

export interface WordToken {
  word: string
  start: number
  end: number
}

/** Whole raw chunks we never spell-check. */
const SKIP_CHUNK = [
  /\d/, // numbers / alphanumerics (covers `{1}` placeholders too)
  /^https?:\/\//i, // url
  /\S+@\S+/, // email / handle
]

/** A word run: a letter followed by letters/apostrophes/hyphens. */
const WORD_RE = /\p{L}[\p{L}'’-]*/gu

function isAllCaps(word: string): boolean {
  return word.length >= 2 && word === word.toUpperCase() && /\p{Lu}/u.test(word)
}

export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = []
  for (const chunk of text.matchAll(/\S+/g)) {
    const raw = chunk[0]
    const chunkStart = chunk.index ?? 0
    if (SKIP_CHUNK.some((re) => re.test(raw))) continue
    for (const m of raw.matchAll(WORD_RE)) {
      const word = m[0].replace(/['’-]+$/u, '') // drop trailing punctuation
      if (!word || isAllCaps(word)) continue
      const start = chunkStart + (m.index ?? 0)
      tokens.push({ word, start, end: start + word.length })
    }
  }
  return tokens
}
