import mammoth from 'mammoth'

import { splitSentences } from './sbdOptions'
import type { ParsedSegment } from './types'
import type { SegmentBlockKind } from '@/core/types'

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

function pushSentences(
  text: string,
  kind: SegmentBlockKind,
  blockIndex: number,
  out: ParsedSegment[],
  extras: Partial<ParsedSegment['sourceMeta']> = {},
): boolean {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return false
  sentences.forEach((source, sentenceIndex) => {
    out.push({
      source,
      sourceMeta: { kind, blockIndex, sentenceIndex, ...extras },
    })
  })
  return true
}

function handleListItem(
  li: Element,
  ordered: boolean,
  blockRef: { v: number },
  out: ParsedSegment[],
) {
  const text = (li.textContent ?? '').trim()
  if (!text) return
  if (pushSentences(text, 'list_item', blockRef.v, out, { ordered })) {
    blockRef.v += 1
  }
}

function handleBlockquote(node: Element, blockRef: { v: number }, out: ParsedSegment[]) {
  const paragraphs = Array.from(node.querySelectorAll(':scope > p'))
  const sources = paragraphs.length > 0
    ? paragraphs.map((p) => (p.textContent ?? '').trim())
    : [(node.textContent ?? '').trim()]
  for (const text of sources) {
    if (!text) continue
    if (pushSentences(text, 'blockquote', blockRef.v, out)) {
      blockRef.v += 1
    }
  }
}

function handleHeading(node: Element, blockRef: { v: number }, out: ParsedSegment[]) {
  const text = (node.textContent ?? '').trim()
  if (!text) return
  const depth = Number(node.tagName.slice(1))
  out.push({
    source: text,
    sourceMeta: {
      kind: 'heading',
      depth: Number.isFinite(depth) ? depth : 1,
      blockIndex: blockRef.v,
      sentenceIndex: 0,
    },
  })
  blockRef.v += 1
}

function handleCode(node: Element, blockRef: { v: number }, out: ParsedSegment[]) {
  const text = node.textContent ?? ''
  if (!text.trim()) return
  out.push({
    source: text,
    sourceMeta: { kind: 'code', blockIndex: blockRef.v, sentenceIndex: 0 },
  })
  blockRef.v += 1
}

function handleParagraph(node: Element, blockRef: { v: number }, out: ParsedSegment[]) {
  const text = (node.textContent ?? '').trim()
  if (!text) return
  if (pushSentences(text, 'paragraph', blockRef.v, out)) {
    blockRef.v += 1
  }
}

function walk(root: Element, blockRef: { v: number }, out: ParsedSegment[]) {
  for (const child of Array.from(root.children)) {
    const tag = child.tagName
    if (HEADING_TAGS.has(tag)) {
      handleHeading(child, blockRef, out)
    } else if (tag === 'P') {
      handleParagraph(child, blockRef, out)
    } else if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL'
      for (const li of Array.from(child.children)) {
        if (li.tagName === 'LI') handleListItem(li, ordered, blockRef, out)
      }
    } else if (tag === 'BLOCKQUOTE') {
      handleBlockquote(child, blockRef, out)
    } else if (tag === 'PRE') {
      handleCode(child, blockRef, out)
    } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
      walk(child, blockRef, out)
    } else {
      handleParagraph(child, blockRef, out)
    }
  }
}

export async function segmentDocx(arrayBuffer: ArrayBuffer): Promise<ParsedSegment[]> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  const out: ParsedSegment[] = []
  const blockRef = { v: 0 }
  walk(body, blockRef, out)
  return out
}
