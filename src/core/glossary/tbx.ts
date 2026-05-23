import type { GlossaryEntry } from '@/core/types'
import { TBX_CREATION_TOOL, TBX_CREATION_TOOL_VERSION } from './constants'

export interface ParsedGlossaryTBX {
  term: string
  definition: string
  notes?: string
  translations: Record<string, string>
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(s: string): string {
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  return cleaned.replace(/[&<>"']/g, (c) => XML_ESCAPE[c])
}

function getXmlLang(el: Element): string | null {
  return (
    el.getAttribute('xml:lang') ??
    el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ??
    el.getAttribute('lang')
  )
}

function childByTag(parent: Element, tag: string): Element | undefined {
  for (const child of Array.from(parent.children)) {
    if (child.nodeName === tag || child.localName === tag) return child
  }
  return undefined
}

function childrenByTag(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter(
    (c) => c.nodeName === tag || c.localName === tag,
  )
}

export function parseTBX(xml: string, sourceLang?: string): ParsedGlossaryTBX[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid TBX: ${parseError.textContent?.trim() ?? 'malformed XML'}`)
  }

  const root = doc.documentElement
  if (!root) throw new Error('Invalid TBX: missing root element')
  const rootName = root.localName ?? root.nodeName
  if (rootName !== 'martif' && rootName !== 'tbx') {
    throw new Error('Invalid TBX: expected <martif> or <tbx> root element')
  }

  const docLang =
    sourceLang ?? getXmlLang(root) ?? undefined

  const termEntries = Array.from(doc.getElementsByTagName('termEntry'))
  const out: ParsedGlossaryTBX[] = []
  for (const te of termEntries) {
    const definition =
      Array.from(te.getElementsByTagName('descrip'))
        .find((d) => d.getAttribute('type') === 'definition')
        ?.textContent?.trim() ?? ''
    const notes = childByTag(te, 'note')?.textContent?.trim()
    const langSets = childrenByTag(te, 'langSet')
    if (langSets.length === 0) continue

    let term = ''
    const translations: Record<string, string> = {}
    for (const ls of langSets) {
      const lang = getXmlLang(ls)
      if (!lang) continue
      const termEl =
        ls.getElementsByTagName('term')[0] ?? null
      const text = termEl?.textContent?.trim() ?? ''
      if (!text) continue
      if (!term && (docLang ? lang === docLang : true)) {
        // First langSet becomes the headword if no source lang declared.
        term = text
        // Don't add the headword's lang as a translation.
        if (!docLang) continue
        if (lang === docLang) continue
      }
      translations[lang] = text
    }
    if (!term) continue
    out.push({ term, definition, notes, translations })
  }
  return out
}

export function exportTBX(entries: GlossaryEntry[], sourceLang = 'en'): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<martif type="TBX-Basic" xml:lang="${escapeXml(sourceLang)}">`)
  lines.push('  <martifHeader>')
  lines.push('    <fileDesc>')
  lines.push(
    `      <sourceDesc><p>${escapeXml(TBX_CREATION_TOOL)} ${escapeXml(TBX_CREATION_TOOL_VERSION)}</p></sourceDesc>`,
  )
  lines.push('    </fileDesc>')
  lines.push('  </martifHeader>')
  lines.push('  <text>')
  lines.push('    <body>')
  for (const e of entries) {
    lines.push(`      <termEntry id="${escapeXml(e.id)}">`)
    if (e.definition) {
      lines.push(`        <descrip type="definition">${escapeXml(e.definition)}</descrip>`)
    }
    if (e.notes) {
      lines.push(`        <note>${escapeXml(e.notes)}</note>`)
    }
    lines.push(`        <langSet xml:lang="${escapeXml(sourceLang)}">`)
    lines.push(`          <tig><term>${escapeXml(e.term)}</term></tig>`)
    lines.push('        </langSet>')
    for (const [lang, translation] of Object.entries(e.translations)) {
      lines.push(`        <langSet xml:lang="${escapeXml(lang)}">`)
      lines.push(`          <tig><term>${escapeXml(translation)}</term></tig>`)
      lines.push('        </langSet>')
    }
    lines.push('      </termEntry>')
  }
  lines.push('    </body>')
  lines.push('  </text>')
  lines.push('</martif>')
  return lines.join('\n') + '\n'
}
