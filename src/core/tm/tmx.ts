import type { TMEntry } from '@/core/types'
import { escapeXml, getXmlLang } from '@/core/xml/escape'
import { TMX_CREATION_TOOL, TMX_CREATION_TOOL_VERSION } from './constants'

export interface ParsedTMXEntry {
  source: string
  target: string
  sourceLang: string
  targetLang: string
}

export interface ParseTMXOptions {
  // When set, multilingual <tu> with more than two <tuv> are reduced to the
  // pair whose xml:lang prefixes (BCP-47 primary subtag) match these codes.
  sourceLang?: string
  targetLang?: string
}

function langPrimary(tag: string | null | undefined): string {
  if (!tag) return ''
  const idx = tag.indexOf('-')
  return (idx === -1 ? tag : tag.slice(0, idx)).toLowerCase()
}

function pickTuvs(
  tuvs: Element[],
  source: string | undefined,
  target: string | undefined,
): [Element, Element] | null {
  if (tuvs.length < 2) return null
  if (tuvs.length === 2) return [tuvs[0], tuvs[1]]
  if (!source || !target) return null
  const wantSrc = langPrimary(source)
  const wantTgt = langPrimary(target)
  const src = tuvs.find((t) => langPrimary(getXmlLang(t)) === wantSrc)
  const tgt = tuvs.find((t) => langPrimary(getXmlLang(t)) === wantTgt)
  if (!src || !tgt || src === tgt) return null
  return [src, tgt]
}

export function parseTMX(xml: string, opts: ParseTMXOptions = {}): ParsedTMXEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid TMX: ${parseError.textContent?.trim() ?? 'malformed XML'}`)
  }

  const root = doc.documentElement
  if (!root || root.nodeName !== 'tmx') {
    throw new Error('Invalid TMX: missing <tmx> root element')
  }

  const entries: ParsedTMXEntry[] = []
  const tus = doc.getElementsByTagName('tu')
  for (let i = 0; i < tus.length; i++) {
    const tu = tus[i]
    const tuvs = Array.from(tu.children).filter((c) => c.nodeName === 'tuv')
    const picked = pickTuvs(tuvs, opts.sourceLang, opts.targetLang)
    if (!picked) continue

    const lang0 = getXmlLang(picked[0])
    const lang1 = getXmlLang(picked[1])
    if (!lang0 || !lang1) continue

    // Level 2 inline tags (<bpt>/<ept>/<ph>/<it>) are stripped by textContent;
    // text inside them is kept. Acceptable for v1 — full tag preservation is
    // out of scope for the TM importer.
    const seg0 = picked[0].getElementsByTagName('seg')[0]?.textContent ?? ''
    const seg1 = picked[1].getElementsByTagName('seg')[0]?.textContent ?? ''
    if (!seg0 || !seg1) continue

    entries.push({
      source: seg0,
      target: seg1,
      sourceLang: lang0,
      targetLang: lang1,
    })
  }

  return entries
}

export function exportTMX(entries: TMEntry[]): string {
  const srclang = entries[0]?.sourceLang ?? '*all*'
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    '<tmx version="1.4">',
    `  <header creationtool="${escapeXml(TMX_CREATION_TOOL)}" creationtoolversion="${escapeXml(TMX_CREATION_TOOL_VERSION)}" segtype="sentence" o-tmf="verbalis" adminlang="en" srclang="${escapeXml(srclang)}" datatype="plaintext"/>`,
    '  <body>',
  )
  for (const e of entries) {
    lines.push(
      `    <tu creationdate="${escapeXml(e.date)}">`,
      `      <tuv xml:lang="${escapeXml(e.sourceLang)}"><seg>${escapeXml(e.source)}</seg></tuv>`,
      `      <tuv xml:lang="${escapeXml(e.targetLang)}"><seg>${escapeXml(e.target)}</seg></tuv>`,
      '    </tu>',
    )
  }
  lines.push('  </body>', '</tmx>')
  return lines.join('\n') + '\n'
}
