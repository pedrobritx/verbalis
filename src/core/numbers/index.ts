// Number handling shared by the QA number-mismatch check and the
// "populate number-only segments" batch action. All comparison logic works on
// Latin (ASCII) digits, so Arabic-Indic, Eastern-Arabic and Devanagari numerals
// compare equal by *value* — which is what a translator cares about. Conversion
// the other way (Latin → a script appropriate for the target language) backs the
// populate action, mirroring memoQ's numeral transliteration.

export type NumeralScript = 'latn' | 'arab' | 'arabext' | 'deva'

const SCRIPT_ZERO: Record<Exclude<NumeralScript, 'latn'>, number> = {
  arab: 0x0660, // Arabic-Indic ٠-٩
  arabext: 0x06f0, // Extended/Eastern Arabic-Indic (Persian/Urdu) ۰-۹
  deva: 0x0966, // Devanagari ०-९
}

/** Convert any supported non-Latin digit to its ASCII (Latin) equivalent. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹०-९]/g, (ch) => {
    const code = ch.charCodeAt(0)
    let base: number
    if (code >= 0x0660 && code <= 0x0669) base = 0x0660
    else if (code >= 0x06f0 && code <= 0x06f9) base = 0x06f0
    else base = 0x0966
    return String(code - base)
  })
}

/** Convert Latin (and any other supported) digits in `text` into `target` script. */
export function convertNumerals(text: string, target: NumeralScript): string {
  const latin = toLatinDigits(text)
  if (target === 'latn') return latin
  const zero = SCRIPT_ZERO[target]
  return latin.replace(/[0-9]/g, (d) => String.fromCharCode(zero + (d.charCodeAt(0) - 48)))
}

/** Pick a sensible numeral script for a BCP-47-ish language tag. */
export function numeralScriptForLang(lang: string): NumeralScript {
  const base = lang.toLowerCase().split(/[-_]/)[0]
  if (base === 'ar') return 'arab'
  if (['fa', 'ur', 'ps', 'ckb'].includes(base)) return 'arabext'
  if (['hi', 'mr', 'ne', 'sa'].includes(base)) return 'deva'
  return 'latn'
}

/**
 * Extract the numeric tokens from `text` as Latin-digit strings, dropping
 * thousands separators that sit between digit groups so "1,000" and "1000"
 * compare equal. Decimal points are preserved.
 */
export function extractNumbers(text: string): string[] {
  const latin = toLatinDigits(text)
  // Grouping separators: comma, space, NBSP, thin space, narrow NBSP.
  const degrouped = latin.replace(/(?<=\d)[,\u0020\u00A0\u2009\u202F](?=\d{3}(?!\d))/g, '')
  return degrouped.match(/\d+(?:\.\d+)?/g) ?? []
}

/** True when `text` carries at least one digit and no letters (any script). */
export function isNumberOnly(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/\p{L}/u.test(t)) return false
  return /[0-9]/.test(toLatinDigits(t))
}

/** Compare two number multisets, order-independent. */
export function sameNumberMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}
