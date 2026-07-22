import type { SegmentSourceMeta } from '@/core/types'
import type { Block, BlockKind } from './model'

/** The minimal segment shape the block builder needs. */
export interface BlockSourceSegment {
  id: string
  sourceMeta?: SegmentSourceMeta
}

export interface BuiltBlocks {
  blocks: Block[]
  /** segmentId → the block it belongs to. */
  segmentBlockIds: Map<string, string>
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  return c?.randomUUID
    ? c.randomUUID()
    : `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Group segments into blocks by their `sourceMeta.blockIndex` — the structure
 * that survives import. One block per distinct block index (in order), taking
 * kind/depth/ordered from the first segment of the group. Segments without
 * `sourceMeta` (e.g. XLIFF trans-units) yield no blocks. Pure and deterministic.
 */
export function buildBlocksFromSegments(
  segments: BlockSourceSegment[],
  opts: { documentId: string; projectId: string },
): BuiltBlocks {
  const segmentBlockIds = new Map<string, string>()
  // Preserve first-seen order of block indices.
  const order: number[] = []
  const groups = new Map<number, { meta: SegmentSourceMeta; segmentIds: string[] }>()

  for (const seg of segments) {
    const meta = seg.sourceMeta
    if (!meta) continue
    const key = meta.blockIndex
    let group = groups.get(key)
    if (!group) {
      group = { meta, segmentIds: [] }
      groups.set(key, group)
      order.push(key)
    }
    group.segmentIds.push(seg.id)
  }

  const blocks: Block[] = order.map((key, i) => {
    const { meta, segmentIds } = groups.get(key)!
    const blockId = newId()
    for (const id of segmentIds) segmentBlockIds.set(id, blockId)
    const block: Block = {
      id: blockId,
      documentId: opts.documentId,
      projectId: opts.projectId,
      index: i,
      kind: meta.kind as BlockKind,
    }
    if (meta.depth !== undefined) block.depth = meta.depth
    if (meta.ordered !== undefined) block.ordered = meta.ordered
    return block
  })

  return { blocks, segmentBlockIds }
}
