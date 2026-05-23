import type { TMEntry } from '@/core/types'
import { TMX_CREATION_TOOL, TMX_CREATION_TOOL_VERSION } from './constants'

export interface ParsedTMXEntry {
  source: string
  target: string
  sourceLang: string
  targetLang: string
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(s: string): string {
  // Strip XML 1.0 invalid control chars (except tab, LF, CR).
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  return cleaned.replace(/[&<>"']/g, (c) => XML_ESCAPE[c])
}

function getXmlLang(tuv: Element): string | null {
  return (
    tuv.getAttribute('xml:lang') ??
    tuv.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ??
    tuv.getAttribute('lang')
  )
}

export function parseTMX(xml: string): ParsedTMXEntry[] {
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
    if (tuvs.length !== 2) continue

    const lang0 = getXmlLang(tuvs[0])
    const lang1 = getXmlLang(tuvs[1])
    if (!lang0 || !lang1) continue

    const seg0 = tuvs[0].getElementsByTagName('seg')[0]?.textContent ?? ''
    const seg1 = tuvs[1].getElementsByTagName('seg')[0]?.textContent ?? ''
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
