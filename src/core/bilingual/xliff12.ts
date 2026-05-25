import type { SegmentStatus } from '@/core/types'
import { escapeXml } from '@/core/xml/escape'
import { statusToXliffState, xliffStateToStatus } from './xliff12Status'

const XLIFF_NS = 'urn:oasis:names:tc:xliff:document:1.2'

export interface ParsedXliffUnit {
  transUnitId: string
  source: string
  target: string
  status: SegmentStatus
  rawState?: string
  note?: string
  inlineTags?: Record<string, string>
}

export interface ParsedXliffDoc {
  templateXml: string
  sourceLang: string
  targetLang: string
  originalFile?: string
  datatype?: string
  units: ParsedXliffUnit[]
}

export interface ExportXliffUnit {
  transUnitId: string
  target: string
  status: SegmentStatus
  inlineTags?: Record<string, string>
}

function findFirstChild(el: Element, localName: string): Element | undefined {
  for (const c of Array.from(el.children)) {
    if (c.localName === localName) return c
  }
  return undefined
}

// Walk source/target children, collapsing each inline element (<g>, <ph>,
// <x>, <bx>, <ex>, <bpt>, <ept>, <it>, <mrk>, …) into an opaque numbered
// placeholder like {1}. The original XML for each element is recorded in
// tagMap so exportXliff12 can splice it back into the target.
//
// Paired wrappers like <g>...</g> become a single placeholder that includes
// their inner text — translators must keep that placeholder verbatim, and
// the wrapped text is not separately editable. Acceptable for v1 since the
// alternative (paired open/close placeholders) raises its own bugs when
// translators reorder content.
function extractInlineTags(
  el: Element,
  startCounter: number,
  tagMap: Record<string, string>,
): { text: string; nextCounter: number } {
  const serializer = new XMLSerializer()
  let counter = startCounter
  let text = ''
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      text += child.textContent ?? ''
    } else if (child.nodeType === 1) {
      counter += 1
      const id = String(counter)
      tagMap[id] = serializer.serializeToString(child as Element)
      text += `{${id}}`
    }
  }
  return { text, nextCounter: counter }
}

export function parseXliff12(xml: string): ParsedXliffDoc {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid XLIFF: ${parseError.textContent?.trim() ?? 'malformed XML'}`)
  }

  const root = doc.documentElement
  if (!root || root.localName !== 'xliff') {
    throw new Error('Invalid XLIFF: missing <xliff> root element')
  }

  const fileEl = doc.getElementsByTagNameNS('*', 'file')[0]
  if (!fileEl) {
    throw new Error('Invalid XLIFF: missing <file> element')
  }

  const sourceLang = fileEl.getAttribute('source-language')
  const targetLang = fileEl.getAttribute('target-language')
  if (!sourceLang) throw new Error('Invalid XLIFF: <file> missing source-language')
  if (!targetLang) throw new Error('Invalid XLIFF: <file> missing target-language')

  const transUnits = Array.from(doc.getElementsByTagNameNS('*', 'trans-unit'))
  const units: ParsedXliffUnit[] = []

  for (const tu of transUnits) {
    const id = tu.getAttribute('id')
    if (!id) continue
    const sourceEl = findFirstChild(tu, 'source')
    if (!sourceEl) continue
    const targetEl = findFirstChild(tu, 'target')
    const noteEl = findFirstChild(tu, 'note')

    const inlineTags: Record<string, string> = {}
    const { text: sourceText, nextCounter } = extractInlineTags(sourceEl, 0, inlineTags)
    const { text: targetText } = targetEl
      ? extractInlineTags(targetEl, nextCounter, inlineTags)
      : { text: '' }

    const rawState = targetEl?.getAttribute('state') ?? undefined
    const approved = tu.getAttribute('approved')
    const status = xliffStateToStatus(rawState, approved)

    units.push({
      transUnitId: id,
      source: sourceText,
      target: targetText,
      status,
      rawState,
      note: noteEl?.textContent?.trim() || undefined,
      inlineTags: Object.keys(inlineTags).length > 0 ? inlineTags : undefined,
    })
  }

  return {
    templateXml: xml,
    sourceLang,
    targetLang,
    originalFile: fileEl.getAttribute('original') ?? undefined,
    datatype: fileEl.getAttribute('datatype') ?? undefined,
    units,
  }
}

function setTargetContent(
  targetEl: Element,
  doc: Document,
  userText: string,
  inlineTags: Record<string, string>,
): void {
  while (targetEl.firstChild) targetEl.removeChild(targetEl.firstChild)

  const PLACEHOLDER_RE = /\{(\d+)\}/g
  const pieces: string[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PLACEHOLDER_RE.exec(userText)) !== null) {
    if (m.index > lastIndex) {
      pieces.push(escapeXml(userText.slice(lastIndex, m.index)))
    }
    const tagXml = inlineTags[m[1]]
    if (tagXml) {
      pieces.push(tagXml)
    } else {
      // Unknown placeholder — keep literal so the user can see what got lost.
      pieces.push(escapeXml(m[0]))
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < userText.length) {
    pieces.push(escapeXml(userText.slice(lastIndex)))
  }

  const ns = targetEl.namespaceURI ?? XLIFF_NS
  const wrapperXml = `<v xmlns="${ns}">${pieces.join('')}</v>`
  const parsed = new DOMParser().parseFromString(wrapperXml, 'application/xml')
  if (parsed.querySelector('parsererror')) {
    targetEl.appendChild(doc.createTextNode(userText))
    return
  }
  for (const child of Array.from(parsed.documentElement.childNodes)) {
    targetEl.appendChild(doc.importNode(child, true))
  }
}

export function exportXliff12(template: string, units: ExportXliffUnit[]): string {
  const doc = new DOMParser().parseFromString(template, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(
      `Invalid XLIFF template: ${parseError.textContent?.trim() ?? 'malformed XML'}`,
    )
  }

  const unitMap = new Map(units.map((u) => [u.transUnitId, u]))
  const transUnits = Array.from(doc.getElementsByTagNameNS('*', 'trans-unit'))

  for (const tu of transUnits) {
    const id = tu.getAttribute('id')
    if (!id) continue
    const u = unitMap.get(id)
    if (!u) continue

    const sourceEl = findFirstChild(tu, 'source')
    let targetEl = findFirstChild(tu, 'target')
    if (!targetEl) {
      const ns = sourceEl?.namespaceURI ?? tu.namespaceURI ?? XLIFF_NS
      targetEl = doc.createElementNS(ns, 'target')
      if (sourceEl?.nextSibling) {
        tu.insertBefore(targetEl, sourceEl.nextSibling)
      } else {
        tu.appendChild(targetEl)
      }
    }

    const { state, approved } = statusToXliffState(u.status)
    if (state) targetEl.setAttribute('state', state)
    else targetEl.removeAttribute('state')
    if (approved === 'yes') tu.setAttribute('approved', 'yes')
    else tu.removeAttribute('approved')

    setTargetContent(targetEl, doc, u.target, u.inlineTags ?? {})
  }

  // XMLSerializer drops the XML declaration; restore it so tools that expect
  // a declaration (some memoQ versions warn on its absence) are happy.
  const body = new XMLSerializer().serializeToString(doc)
  return body.startsWith('<?xml')
    ? body
    : '<?xml version="1.0" encoding="UTF-8"?>\n' + body
}
