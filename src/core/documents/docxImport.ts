import mammoth from 'mammoth'
import { splitSentences } from '@/core/segmentation/sbdOptions'
import type { ParsedSegment } from '@/core/segmentation/types'
import type { SegmentBlockKind } from '@/core/types'
import type { BlockKind, BlockAttrs, InlineRun } from './model'

/**
 * Higher-fidelity DOCX import (Milestone 2, Phase 2.2). mammoth converts the
 * document to HTML (with an explicit style map + image capture); a walker then
 * produces both the flat `ParsedSegment[]` the segment pipeline expects (contract
 * unchanged) AND a structured block list carrying inline formatting runs, tables
 * and image references, plus the captured image assets. mammoth is the only
 * browser-side DOCX parser, so fidelity is bounded by what it exposes (no
 * headers/footers/text-boxes/exact footnote placement); we keep the original
 * file as an asset so a future OOXML-native parser can re-import losslessly.
 */

/** A block parsed from the document, before it is assigned a persisted id. */
export interface ParsedBlock {
  blockIndex: number
  kind: BlockKind
  depth?: number
  ordered?: boolean
  sourceRuns?: InlineRun[]
  attrs?: BlockAttrs
}

/** An image extracted during conversion, keyed by the id referenced in a block. */
export interface ParsedDocxAsset {
  id: string
  mime: string
  blob: Blob
  name?: string
}

export interface ParsedDocx {
  segments: ParsedSegment[]
  blocks: ParsedBlock[]
  assets: ParsedDocxAsset[]
}

// Explicit style map so common Word paragraph/character styles land on semantic
// HTML the walker understands (mammoth already maps Heading 1–6 by default).
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
]

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

interface Fmt {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  sub?: boolean
  sup?: boolean
  href?: string
}

function sameFmt(a: InlineRun, b: Fmt): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.sub === !!b.sub &&
    !!a.sup === !!b.sup &&
    a.href === b.href
  )
}

function pushRun(runs: InlineRun[], text: string, fmt: Fmt): void {
  if (!text) return
  const last = runs[runs.length - 1]
  if (last && sameFmt(last, fmt)) {
    last.text += text
    return
  }
  runs.push({ text, ...fmt })
}

/** Extract inline formatting runs from an element's descendants (merging like runs). */
export function extractRuns(el: Node): InlineRun[] {
  const runs: InlineRun[] = []
  const visit = (node: Node, fmt: Fmt) => {
    if (node.nodeType === 3 /* text */) {
      pushRun(runs, node.textContent ?? '', fmt)
      return
    }
    if (node.nodeType !== 1 /* element */) return
    const e = node as Element
    const tag = e.tagName
    if (tag === 'IMG') return
    if (tag === 'BR') {
      pushRun(runs, '\n', fmt)
      return
    }
    const next: Fmt = { ...fmt }
    if (tag === 'STRONG' || tag === 'B') next.bold = true
    else if (tag === 'EM' || tag === 'I') next.italic = true
    else if (tag === 'U') next.underline = true
    else if (tag === 'SUB') next.sub = true
    else if (tag === 'SUP') next.sup = true
    else if (tag === 'A') next.href = e.getAttribute('href') ?? undefined
    for (const child of Array.from(e.childNodes)) visit(child, next)
  }
  for (const child of Array.from(el.childNodes)) visit(child, {})
  return runs
}

/** The single image directly inside a paragraph (image-only paragraph), if any. */
function loneImage(el: Element): Element | null {
  if ((el.textContent ?? '').trim()) return null
  const img = el.querySelector('img')
  return img
}

interface Ctx {
  blockIndex: number
  segments: ParsedSegment[]
  blocks: ParsedBlock[]
}

function emitSentences(
  text: string,
  kind: SegmentBlockKind,
  ctx: Ctx,
  extras: Partial<ParsedSegment['sourceMeta']>,
): boolean {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return false
  sentences.forEach((source, sentenceIndex) => {
    ctx.segments.push({ source, sourceMeta: { kind, blockIndex: ctx.blockIndex, sentenceIndex, ...extras } })
  })
  return true
}

function emitTextBlock(el: Element, text: string, kind: SegmentBlockKind, ctx: Ctx, extras: Partial<ParsedSegment['sourceMeta']> = {}) {
  if (!emitSentences(text, kind, ctx, extras)) return
  ctx.blocks.push({
    blockIndex: ctx.blockIndex,
    kind: kind as BlockKind,
    ...(extras.depth !== undefined ? { depth: extras.depth } : {}),
    ...(extras.ordered !== undefined ? { ordered: extras.ordered } : {}),
    sourceRuns: extractRuns(el),
    ...(kind === 'heading' && extras.depth ? { attrs: { level: extras.depth } } : {}),
  })
  ctx.blockIndex += 1
}

function emitImageBlock(img: Element, ctx: Ctx) {
  const assetId = img.getAttribute('data-asset-ref') || undefined
  if (!assetId) return
  ctx.blocks.push({
    blockIndex: ctx.blockIndex,
    kind: 'image',
    attrs: { assetId, alt: img.getAttribute('alt') || undefined },
  })
  ctx.blockIndex += 1
}

function emitTableBlock(table: Element, ctx: Ctx) {
  const rows: InlineRun[][][] = []
  let sentenceIndex = 0
  for (const tr of Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'))) {
    const cells: InlineRun[][] = []
    for (const cell of Array.from(tr.children)) {
      if (cell.tagName !== 'TD' && cell.tagName !== 'TH') continue
      cells.push(extractRuns(cell))
      const text = (cell.textContent ?? '').trim()
      // Each non-empty cell's text is a translatable segment under the table block.
      if (text) {
        ctx.segments.push({
          source: text,
          sourceMeta: { kind: 'paragraph', blockIndex: ctx.blockIndex, sentenceIndex },
        })
        sentenceIndex += 1
      }
    }
    rows.push(cells)
  }
  if (rows.length === 0) return
  ctx.blocks.push({ blockIndex: ctx.blockIndex, kind: 'table', attrs: { rows } })
  ctx.blockIndex += 1
}

function walk(root: Element, ctx: Ctx) {
  for (const child of Array.from(root.children)) {
    const tag = child.tagName
    if (HEADING_TAGS.has(tag)) {
      const depth = Number(tag.slice(1))
      const text = (child.textContent ?? '').trim()
      if (text) emitTextBlock(child, text, 'heading', ctx, { depth: Number.isFinite(depth) ? depth : 1 })
    } else if (tag === 'P') {
      const img = loneImage(child)
      if (img) {
        emitImageBlock(img, ctx)
      } else {
        const text = (child.textContent ?? '').trim()
        if (text) emitTextBlock(child, text, 'paragraph', ctx)
      }
    } else if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL'
      for (const li of Array.from(child.children)) {
        if (li.tagName !== 'LI') continue
        const text = (li.textContent ?? '').trim()
        if (text) emitTextBlock(li, text, 'list_item', ctx, { ordered })
      }
    } else if (tag === 'BLOCKQUOTE') {
      const paragraphs = Array.from(child.querySelectorAll(':scope > p'))
      const sources: Element[] = paragraphs.length > 0 ? paragraphs : [child]
      for (const p of sources) {
        const text = (p.textContent ?? '').trim()
        if (text) emitTextBlock(p, text, 'blockquote', ctx)
      }
    } else if (tag === 'PRE') {
      const raw = child.textContent ?? ''
      if (raw.trim()) {
        ctx.segments.push({ source: raw, sourceMeta: { kind: 'code', blockIndex: ctx.blockIndex, sentenceIndex: 0 } })
        ctx.blocks.push({ blockIndex: ctx.blockIndex, kind: 'code', sourceRuns: [{ text: raw }] })
        ctx.blockIndex += 1
      }
    } else if (tag === 'TABLE') {
      emitTableBlock(child, ctx)
    } else if (tag === 'IMG') {
      emitImageBlock(child, ctx)
    } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
      walk(child, ctx)
    } else {
      const text = (child.textContent ?? '').trim()
      if (text) emitTextBlock(child, text, 'paragraph', ctx)
    }
  }
}

/** Parse mammoth-converted HTML into segments + structured blocks. Pure. */
export function htmlToParsedDocx(html: string): { segments: ParsedSegment[]; blocks: ParsedBlock[] } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const ctx: Ctx = { blockIndex: 0, segments: [], blocks: [] }
  walk(doc.body, ctx)
  return { segments: ctx.segments, blocks: ctx.blocks }
}

/** Full DOCX import: HTML conversion (styleMap + image capture) → segments/blocks/assets. */
export async function parseDocxDocument(arrayBuffer: ArrayBuffer): Promise<ParsedDocx> {
  const assets: ParsedDocxAsset[] = []
  const options: Record<string, unknown> = { styleMap: STYLE_MAP }
  // mammoth.images is unavailable under the segmentation test's minimal mock;
  // guard so image capture is opt-in on the real library.
  const images = (mammoth as unknown as { images?: { imgElement?: (fn: (image: DocxImage) => Promise<Record<string, string>>) => unknown } }).images
  if (images?.imgElement) {
    options.convertImage = images.imgElement(async (image: DocxImage) => {
      const id = crypto.randomUUID()
      const base64 = await image.read('base64')
      assets.push({ id, mime: image.contentType, blob: base64ToBlob(base64, image.contentType) })
      return { src: '', 'data-asset-ref': id, alt: image.altText ?? '' }
    })
  }
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, options)
  const { segments, blocks } = htmlToParsedDocx(html)
  // Only keep assets that a block actually references.
  const used = new Set(blocks.map((b) => b.attrs?.assetId).filter(Boolean) as string[])
  return { segments, blocks, assets: assets.filter((a) => used.has(a.id)) }
}

interface DocxImage {
  read(encoding: 'base64'): Promise<string>
  contentType: string
  altText?: string
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
