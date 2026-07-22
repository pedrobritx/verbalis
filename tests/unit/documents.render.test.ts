import { describe, it, expect } from 'vitest'
import { renderDocument } from '@/core/documents/render'
import type { Block } from '@/core/documents/model'
import type { Segment } from '@/core/types'

function seg(overrides: Partial<Segment> & { id: string; index: number }): Segment {
  return {
    projectId: 'p',
    source: '',
    target: '',
    status: 'untranslated',
    createdAt: 'n',
    updatedAt: 'n',
    ...overrides,
  }
}

function block(overrides: Partial<Block> & { id: string; index: number }): Block {
  return { documentId: 'd', projectId: 'p', kind: 'paragraph', ...overrides }
}

describe('renderDocument', () => {
  it('assembles blocks in order with translated targets, source fallback for untranslated', () => {
    const blocks = [
      block({ id: 'b1', index: 1, kind: 'paragraph' }),
      block({ id: 'b0', index: 0, kind: 'heading', depth: 1 }),
    ]
    const segments = [
      seg({
        id: 's-h',
        index: 0,
        blockId: 'b0',
        source: 'Title',
        target: 'Titre',
        sourceMeta: { kind: 'heading', blockIndex: 0, sentenceIndex: 0 },
      }),
      // Two sentences in b1: first translated, second not.
      seg({
        id: 's-a',
        index: 1,
        blockId: 'b1',
        source: 'One.',
        target: 'Un.',
        sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 0 },
      }),
      seg({
        id: 's-b',
        index: 2,
        blockId: 'b1',
        source: 'Two.',
        target: '',
        sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 1 },
      }),
    ]

    const model = renderDocument(blocks, segments)
    expect(model.map((b) => b.kind)).toEqual(['heading', 'paragraph']) // sorted by index
    expect(model[0].targetText).toBe('Titre')
    expect(model[0].fullyTranslated).toBe(true)
    // Paragraph: translated sentence uses target, untranslated falls back to source.
    expect(model[1].targetText).toBe('Un. Two.')
    expect(model[1].fullyTranslated).toBe(false)
    expect(model[1].hasTranslation).toBe(true)
    // refs carry per-sentence translated flags + segment indices for click-through.
    expect(model[1].refs).toEqual([
      { segmentId: 's-a', index: 1, translated: true },
      { segmentId: 's-b', index: 2, translated: false },
    ])
  })

  it('respects sentenceIndex order regardless of segment array order', () => {
    const blocks = [block({ id: 'b', index: 0 })]
    const segments = [
      seg({
        id: 's2',
        index: 1,
        blockId: 'b',
        source: 'B.',
        target: 'Bt.',
        sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 1 },
      }),
      seg({
        id: 's1',
        index: 0,
        blockId: 'b',
        source: 'A.',
        target: 'At.',
        sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 0 },
      }),
    ]
    expect(renderDocument(blocks, segments)[0].targetText).toBe('At. Bt.')
  })

  it('maps table cells to segments in row-major order and carries image asset ids', () => {
    const blocks = [
      block({
        id: 't',
        index: 0,
        kind: 'table',
        attrs: { rows: [[[{ text: 'H' }], [{ text: '' }]], [[{ text: 'C' }]]] },
      }),
      block({ id: 'img', index: 1, kind: 'image', attrs: { assetId: 'a9' } }),
    ]
    const segments = [
      seg({
        id: 'c0',
        index: 0,
        blockId: 't',
        source: 'H',
        target: 'Ht',
        sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 0 },
      }),
      seg({
        id: 'c1',
        index: 1,
        blockId: 't',
        source: 'C',
        target: '',
        sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 1 },
      }),
    ]
    const model = renderDocument(blocks, segments)
    const table = model[0]
    expect(table.rows![0][0].targetText).toBe('Ht') // first non-empty cell → first segment
    expect(table.rows![0][1].ref).toBeUndefined() // empty cell → no segment
    expect(table.rows![1][0].targetText).toBe('C') // untranslated → source fallback
    expect(model[1].assetId).toBe('a9')
  })
})
