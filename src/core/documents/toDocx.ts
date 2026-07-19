import type { Segment } from '@/core/types'
import type { Block, Asset, InlineRun } from './model'
import { targetRichToRuns } from './targetRuns'
import { runsText } from './render'

/**
 * Reconstruct a clean translated .docx from the document/block tree + the
 * translated segments (Phase 2.4). Headings, lists, quotes, code, tables and
 * images are rebuilt; target formatting comes from each segment's `targetRich`
 * runs (accepted-preview for tracked changes, per D2) or plain text. `docx` is
 * loaded via dynamic import so it costs nothing until an export happens.
 */

/** A segment's runs for export: targetRich formatting, or plain target, or source. */
function segmentRuns(seg: Segment): InlineRun[] {
  const target = seg.target.trim()
  if (!target) return [{ text: seg.source }] // untranslated → keep source
  if (seg.targetRich) {
    const runs = targetRichToRuns(seg.targetRich)
    if (runs.length) return runs
  }
  return [{ text: seg.target }]
}

/** Concatenate a block's sentence segments into one run list, space-joined. */
function blockRuns(segs: Segment[]): InlineRun[] {
  const runs: InlineRun[] = []
  segs.forEach((s, i) => {
    if (i > 0) runs.push({ text: ' ' })
    runs.push(...segmentRuns(s))
  })
  return runs
}

function bySentence(a: Segment, b: Segment): number {
  return (a.sourceMeta?.sentenceIndex ?? 0) - (b.sourceMeta?.sentenceIndex ?? 0)
}

function imageType(mime: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('bmp')) return 'bmp'
  return 'png'
}

/** Whether any segment still carries pending tracked changes (for a warning). */
export function hasPendingForExport(segments: Segment[]): boolean {
  return segments.some((s) => s.targetRich?.includes('"type":"change-mark"'))
}

export async function exportProjectDocx(
  blocks: Block[],
  segments: Segment[],
  assets: Asset[],
): Promise<Blob> {
  const docx = await import('docx')
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ExternalHyperlink,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    ImageRun,
    WidthType,
  } = docx

  const byBlock = new Map<string, Segment[]>()
  for (const s of segments) {
    if (!s.blockId) continue
    const arr = byBlock.get(s.blockId)
    if (arr) arr.push(s)
    else byBlock.set(s.blockId, [s])
  }
  const assetById = new Map(assets.map((a) => [a.id, a]))

  const HEADING = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runChildren = (runs: InlineRun[], opts: { font?: string } = {}): any[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = []
    for (const r of runs) {
      r.text.split('\n').forEach((part, i) => {
        const run = new TextRun({
          text: part,
          bold: r.bold,
          italics: r.italic,
          underline: r.underline ? {} : undefined,
          subScript: r.sub,
          superScript: r.sup,
          font: opts.font,
          break: i > 0 ? 1 : undefined,
        })
        out.push(r.href ? new ExternalHyperlink({ link: r.href, children: [run] }) : run)
      })
    }
    return out
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []
  const ordered = [...blocks].sort((a, b) => a.index - b.index)

  for (const block of ordered) {
    const segs = (byBlock.get(block.id) ?? []).slice().sort(bySentence)

    if (block.kind === 'image') {
      const asset = block.attrs?.assetId ? assetById.get(block.attrs.assetId) : undefined
      if (asset) {
        const data = new Uint8Array(await asset.blob.arrayBuffer())
        children.push(
          new Paragraph({
            children: [
              new ImageRun({ type: imageType(asset.mime), data, transformation: { width: 400, height: 300 } }),
            ],
          }),
        )
      }
      continue
    }

    if (block.kind === 'table') {
      let next = 0
      const rows = (block.attrs?.rows ?? []).map(
        (row) =>
          new TableRow({
            children: row.map((cellRuns) => {
              const hasText = runsText(cellRuns).trim().length > 0
              const seg = hasText ? segs[next++] : undefined
              const runs = seg ? segmentRuns(seg) : cellRuns
              return new TableCell({ children: [new Paragraph({ children: runChildren(runs) })] })
            }),
          }),
      )
      if (rows.length > 0) {
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
      }
      continue
    }

    const runs = blockRuns(segs)
    if (block.kind === 'heading') {
      children.push(new Paragraph({ heading: HEADING[Math.min(5, Math.max(0, (block.depth ?? 1) - 1))], children: runChildren(runs) }))
    } else if (block.kind === 'list_item') {
      children.push(
        new Paragraph({
          children: runChildren(runs),
          ...(block.ordered
            ? { numbering: { reference: 'ordered-list', level: 0 } }
            : { bullet: { level: 0 } }),
        }),
      )
    } else if (block.kind === 'blockquote') {
      children.push(new Paragraph({ children: runChildren(runs), indent: { left: 720 } }))
    } else if (block.kind === 'code') {
      children.push(new Paragraph({ children: runChildren(runs, { font: 'Courier New' }) }))
    } else {
      children.push(new Paragraph({ children: runChildren(runs) }))
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: docx.AlignmentType.START }],
        },
      ],
    },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}
