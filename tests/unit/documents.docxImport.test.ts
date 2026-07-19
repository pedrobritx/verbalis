import { describe, it, expect } from 'vitest'
import { htmlToParsedDocx, extractRuns } from '@/core/documents/docxImport'

function firstBlock(html: string) {
  return htmlToParsedDocx(html).blocks[0]
}

describe('extractRuns', () => {
  function runs(html: string) {
    const el = new DOMParser().parseFromString(`<body><p>${html}</p></body>`, 'text/html').body
      .firstElementChild as Element
    return extractRuns(el)
  }

  it('captures bold / italic / underline / sub / sup / links, merging like runs', () => {
    const out = runs('plain <strong>bold</strong> and <em>it</em><sub>x</sub><sup>y</sup> <a href="u">link</a>')
    expect(out).toEqual([
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'it', italic: true },
      { text: 'x', sub: true },
      { text: 'y', sup: true },
      { text: ' ' },
      { text: 'link', href: 'u' },
    ])
  })

  it('composes nested formats', () => {
    expect(runs('<strong><em>both</em></strong>')).toEqual([{ text: 'both', bold: true, italic: true }])
  })
})

describe('htmlToParsedDocx', () => {
  it('keeps whole-block source runs on a heading while segmenting text', () => {
    const { segments, blocks } = htmlToParsedDocx('<h2>The <strong>Big</strong> Title</h2>')
    expect(segments).toEqual([
      { source: 'The Big Title', sourceMeta: { kind: 'heading', depth: 2, blockIndex: 0, sentenceIndex: 0 } },
    ])
    expect(blocks[0]).toMatchObject({
      kind: 'heading',
      depth: 2,
      attrs: { level: 2 },
      sourceRuns: [{ text: 'The ' }, { text: 'Big', bold: true }, { text: ' Title' }],
    })
  })

  it('captures a paragraph block with runs while splitting sentences', () => {
    const { segments, blocks } = htmlToParsedDocx('<p>One <em>two</em>. Three.</p>')
    expect(segments.map((s) => s.source)).toEqual(['One two.', 'Three.'])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('paragraph')
    expect(blocks[0].sourceRuns).toEqual([{ text: 'One ' }, { text: 'two', italic: true }, { text: '. Three.' }])
  })

  it('emits a table block with cell runs and one segment per non-empty cell', () => {
    const { segments, blocks } = htmlToParsedDocx(
      '<table><tr><td>A one.</td><td><strong>B</strong></td></tr><tr><td>C.</td><td></td></tr></table>',
    )
    const table = blocks.find((b) => b.kind === 'table')!
    expect(table.attrs?.rows).toEqual([
      [[{ text: 'A one.' }], [{ text: 'B', bold: true }]],
      [[{ text: 'C.' }], []],
    ])
    // Non-empty cells become translatable segments under the table's block index.
    expect(segments.map((s) => s.source)).toEqual(['A one.', 'B', 'C.'])
    expect(segments.every((s) => s.sourceMeta.blockIndex === table.blockIndex)).toBe(true)
  })

  it('emits an image block from a lone-image paragraph and advances the block index', () => {
    const { segments, blocks } = htmlToParsedDocx(
      '<p>Intro.</p><p><img data-asset-ref="a1" alt="Chart" /></p><p>After.</p>',
    )
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'image', 'paragraph'])
    expect(blocks[1]).toMatchObject({ blockIndex: 1, attrs: { assetId: 'a1', alt: 'Chart' } })
    // The image contributes no segment; the following paragraph is block 2.
    expect(segments.map((s) => s.sourceMeta.blockIndex)).toEqual([0, 2])
  })

  it('does not create blocks for empty paragraphs', () => {
    expect(htmlToParsedDocx('<p>   </p><p>Real.</p>').blocks).toHaveLength(1)
    expect(firstBlock('<p>   </p><p>Real.</p>').blockIndex).toBe(0)
  })
})
