import { describe, expect, it } from 'vitest'
import { buildBlocksFromSegments } from '@/core/documents/fromSegments'
import type { SegmentSourceMeta } from '@/core/types'

function seg(id: string, meta?: Partial<SegmentSourceMeta>) {
  return {
    id,
    sourceMeta: meta
      ? {
          kind: 'paragraph' as const,
          blockIndex: 0,
          sentenceIndex: 0,
          ...meta,
        }
      : undefined,
  }
}

describe('buildBlocksFromSegments', () => {
  it('groups segments by blockIndex into one block each, in order', () => {
    const segments = [
      seg('a', { kind: 'heading', blockIndex: 0, sentenceIndex: 0, depth: 1 }),
      seg('b', { kind: 'paragraph', blockIndex: 1, sentenceIndex: 0 }),
      seg('c', { kind: 'paragraph', blockIndex: 1, sentenceIndex: 1 }),
      seg('d', { kind: 'list_item', blockIndex: 2, sentenceIndex: 0, ordered: true, depth: 0 }),
    ]
    const { blocks, segmentBlockIds } = buildBlocksFromSegments(segments, {
      documentId: 'doc1',
      projectId: 'p1',
    })

    expect(blocks).toHaveLength(3)
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list_item'])
    expect(blocks.map((b) => b.index)).toEqual([0, 1, 2])
    expect(blocks[0].depth).toBe(1)
    expect(blocks[2].ordered).toBe(true)
    // The two sentences of block 1 map to the same block.
    expect(segmentBlockIds.get('b')).toBe(blocks[1].id)
    expect(segmentBlockIds.get('c')).toBe(blocks[1].id)
    expect(segmentBlockIds.get('a')).toBe(blocks[0].id)
    // Every block belongs to the given document/project.
    expect(blocks.every((b) => b.documentId === 'doc1' && b.projectId === 'p1')).toBe(true)
  })

  it('yields no blocks for segments without sourceMeta (e.g. XLIFF)', () => {
    const { blocks, segmentBlockIds } = buildBlocksFromSegments(
      [seg('x'), seg('y')],
      { documentId: 'd', projectId: 'p' },
    )
    expect(blocks).toEqual([])
    expect(segmentBlockIds.size).toBe(0)
  })
})
