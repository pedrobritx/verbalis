import { describe, it, expect, vi, beforeEach } from 'vitest'

const convertToHtml =
  vi.fn<(args: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>>()

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: (args: { arrayBuffer: ArrayBuffer }) => convertToHtml(args),
  },
}))

import { segmentDocx } from '@/core/segmentation'

function mockHtml(html: string) {
  convertToHtml.mockResolvedValueOnce({ value: html, messages: [] })
}

const EMPTY_BUFFER = new ArrayBuffer(0)

describe('segmentDocx', () => {
  beforeEach(() => {
    convertToHtml.mockReset()
  })

  it('returns empty for empty html', async () => {
    mockHtml('')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out).toEqual([])
  })

  it('emits heading segments with depth from h1-h6', async () => {
    mockHtml('<h1>Title</h1><h3>Sub</h3>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({
      source: 'Title',
      sourceMeta: { kind: 'heading', depth: 1, blockIndex: 0, sentenceIndex: 0 },
    })
    expect(out[1]).toMatchObject({
      source: 'Sub',
      sourceMeta: { kind: 'heading', depth: 3, blockIndex: 1, sentenceIndex: 0 },
    })
  })

  it('splits paragraphs into sentences and tracks blockIndex', async () => {
    mockHtml('<p>First sentence. Second sentence.</p><p>Para two.</p>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out.map((s) => s.source)).toEqual(['First sentence.', 'Second sentence.', 'Para two.'])
    expect(out.map((s) => s.sourceMeta.blockIndex)).toEqual([0, 0, 1])
    expect(out.map((s) => s.sourceMeta.sentenceIndex)).toEqual([0, 1, 0])
    expect(out.every((s) => s.sourceMeta.kind === 'paragraph')).toBe(true)
  })

  it('tags ordered vs unordered list items', async () => {
    mockHtml('<ul><li>alpha item.</li><li>beta item.</li></ul><ol><li>one item.</li></ol>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({
      source: 'alpha item.',
      sourceMeta: { kind: 'list_item', ordered: false, blockIndex: 0 },
    })
    expect(out[1]).toMatchObject({
      source: 'beta item.',
      sourceMeta: { kind: 'list_item', ordered: false, blockIndex: 1 },
    })
    expect(out[2]).toMatchObject({
      source: 'one item.',
      sourceMeta: { kind: 'list_item', ordered: true, blockIndex: 2 },
    })
  })

  it('emits a blockquote per paragraph child', async () => {
    mockHtml('<blockquote><p>Quote one. Quote two.</p></blockquote>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out.map((s) => s.source)).toEqual(['Quote one.', 'Quote two.'])
    expect(out.every((s) => s.sourceMeta.kind === 'blockquote')).toBe(true)
  })

  it('keeps <pre> blocks as raw code without sentence splitting', async () => {
    mockHtml('<pre>const x = 1;\nconst y = 2;</pre>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      source: 'const x = 1;\nconst y = 2;',
      sourceMeta: { kind: 'code', blockIndex: 0, sentenceIndex: 0 },
    })
  })

  it('skips empty blocks and trims whitespace', async () => {
    mockHtml('<p>   </p><p>Real text.</p><p></p>')
    const out = await segmentDocx(EMPTY_BUFFER)
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('Real text.')
    expect(out[0].sourceMeta.blockIndex).toBe(0)
  })
})
