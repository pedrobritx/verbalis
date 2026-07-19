import type { Segment } from '@/core/types'
import type { Block, BlockKind, InlineRun } from './model'

/**
 * Assemble a document's blocks + its translated segments into a flat render
 * model for the preview (Phase 2.3). Pure and deterministic: a block's target
 * text is its segments' targets (ordered by `sentenceIndex`, falling back to the
 * source for still-untranslated sentences). Tables map cells to segments in
 * row-major order; images carry their asset id.
 */

export interface RenderSegmentRef {
  segmentId: string
  /** 0-based segment index in the project, for click-to-focus. */
  index: number
  translated: boolean
}

export interface RenderCell {
  sourceRuns: InlineRun[]
  sourceText: string
  targetText: string
  ref?: RenderSegmentRef
}

export interface RenderBlock {
  id: string
  kind: BlockKind
  depth?: number
  ordered?: boolean
  sourceRuns?: InlineRun[]
  sourceText: string
  targetText: string
  /** True when the block has segments and all of them are translated. */
  fullyTranslated: boolean
  /** True when at least one segment is translated. */
  hasTranslation: boolean
  refs: RenderSegmentRef[]
  /** For `table` blocks: rows of cells. */
  rows?: RenderCell[][]
  /** For `image` blocks: the referenced asset id. */
  assetId?: string
}

const SENTENCE_JOIN = ' '

export function runsText(runs: InlineRun[] | undefined): string {
  return (runs ?? []).map((r) => r.text).join('')
}

function isTranslated(seg: Segment): boolean {
  return seg.target.trim().length > 0
}

function refOf(seg: Segment): RenderSegmentRef {
  return { segmentId: seg.id, index: seg.index, translated: isTranslated(seg) }
}

/** A segment's target, or its source when still untranslated (preview fallback). */
function targetOrSource(seg: Segment): string {
  return isTranslated(seg) ? seg.target : seg.source
}

function buildTextBlock(block: Block, segs: Segment[]): RenderBlock {
  const join = block.kind === 'code' ? '\n' : SENTENCE_JOIN
  const sourceText = block.sourceRuns ? runsText(block.sourceRuns) : segs.map((s) => s.source).join(join)
  return {
    id: block.id,
    kind: block.kind,
    depth: block.depth,
    ordered: block.ordered,
    sourceRuns: block.sourceRuns,
    sourceText,
    targetText: segs.map(targetOrSource).join(join),
    fullyTranslated: segs.length > 0 && segs.every(isTranslated),
    hasTranslation: segs.some(isTranslated),
    refs: segs.map(refOf),
  }
}

function buildTableBlock(block: Block, segs: Segment[]): RenderBlock {
  let next = 0
  const rows: RenderCell[][] = (block.attrs?.rows ?? []).map((row) =>
    row.map((cellRuns) => {
      const sourceText = runsText(cellRuns)
      // Non-empty cells consumed a segment (in row-major order) at import.
      const seg = sourceText.trim() ? segs[next++] : undefined
      return {
        sourceRuns: cellRuns,
        sourceText,
        targetText: seg ? targetOrSource(seg) : sourceText,
        ref: seg ? refOf(seg) : undefined,
      }
    }),
  )
  return {
    id: block.id,
    kind: 'table',
    sourceText: segs.map((s) => s.source).join(SENTENCE_JOIN),
    targetText: segs.map(targetOrSource).join(SENTENCE_JOIN),
    fullyTranslated: segs.length > 0 && segs.every(isTranslated),
    hasTranslation: segs.some(isTranslated),
    refs: segs.map(refOf),
    rows,
  }
}

export function renderDocument(blocks: Block[], segments: Segment[]): RenderBlock[] {
  const byBlock = new Map<string, Segment[]>()
  for (const s of segments) {
    if (!s.blockId) continue
    const arr = byBlock.get(s.blockId)
    if (arr) arr.push(s)
    else byBlock.set(s.blockId, [s])
  }
  for (const arr of byBlock.values()) {
    arr.sort((a, b) => (a.sourceMeta?.sentenceIndex ?? 0) - (b.sourceMeta?.sentenceIndex ?? 0))
  }

  return [...blocks]
    .sort((a, b) => a.index - b.index)
    .map((block) => {
      const segs = byBlock.get(block.id) ?? []
      if (block.kind === 'table') return buildTableBlock(block, segs)
      if (block.kind === 'image') {
        return {
          id: block.id,
          kind: 'image' as BlockKind,
          sourceText: '',
          targetText: '',
          fullyTranslated: true,
          hasTranslation: false,
          refs: [],
          assetId: block.attrs?.assetId,
        }
      }
      return buildTextBlock(block, segs)
    })
}
