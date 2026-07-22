import { describe, it, expect } from 'vitest'
import { segmentText as segment, detectType } from '@/core/segmentation'

describe('detectType', () => {
  it('treats .md and .markdown as md', () => {
    expect(detectType('foo.md')).toBe('md')
    expect(detectType('Foo.MARKDOWN')).toBe('md')
  })
  it('treats .docx as docx', () => {
    expect(detectType('foo.docx')).toBe('docx')
    expect(detectType('Foo.DOCX')).toBe('docx')
  })
  it('defaults to txt', () => {
    expect(detectType('foo.txt')).toBe('txt')
    expect(detectType('foo')).toBe('txt')
  })
})

describe('segment TXT', () => {
  it('returns empty array for empty input', () => {
    expect(segment('', 'txt')).toEqual([])
    expect(segment('   \n  \n', 'txt')).toEqual([])
  })

  it('splits a single paragraph into one segment when one sentence', () => {
    const out = segment('Hello world.', 'txt')
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('Hello world.')
    expect(out[0].sourceMeta.kind).toBe('paragraph')
    expect(out[0].sourceMeta.blockIndex).toBe(0)
    expect(out[0].sourceMeta.sentenceIndex).toBe(0)
  })

  it('splits paragraph into multiple sentences', () => {
    const out = segment('First sentence. Second sentence. Third one.', 'txt')
    expect(out).toHaveLength(3)
    expect(out.map((s) => s.source)).toEqual(['First sentence.', 'Second sentence.', 'Third one.'])
    expect(out.map((s) => s.sourceMeta.sentenceIndex)).toEqual([0, 1, 2])
    expect(out.every((s) => s.sourceMeta.blockIndex === 0)).toBe(true)
  })

  it('separates blocks by blank lines and tracks blockIndex', () => {
    const out = segment('Para one.\n\nPara two. Two-two.', 'txt')
    expect(out).toHaveLength(3)
    expect(out[0].sourceMeta.blockIndex).toBe(0)
    expect(out[1].sourceMeta.blockIndex).toBe(1)
    expect(out[2].sourceMeta.blockIndex).toBe(1)
    expect(out[2].sourceMeta.sentenceIndex).toBe(1)
  })

  it('handles trailing whitespace and multiple blank lines', () => {
    const out = segment('A.\n\n\n\nB.\n   \n', 'txt')
    expect(out.map((s) => s.source)).toEqual(['A.', 'B.'])
  })
})

describe('segment MD', () => {
  it('parses heading + paragraph + list + code block + blockquote', () => {
    const md = [
      '# Title',
      '',
      'First sentence. Second sentence.',
      '',
      '- alpha item.',
      '- beta item.',
      '',
      '```js',
      'const x = 1;',
      'const y = 2;',
      '```',
      '',
      '> Quote one. Quote two.',
    ].join('\n')

    const out = segment(md, 'md')
    const kinds = out.map((s) => s.sourceMeta.kind)

    expect(out[0].source).toBe('Title')
    expect(out[0].sourceMeta.kind).toBe('heading')
    expect(out[0].sourceMeta.depth).toBe(1)

    const paragraphs = out.filter((s) => s.sourceMeta.kind === 'paragraph')
    expect(paragraphs.map((p) => p.source)).toEqual(['First sentence.', 'Second sentence.'])

    const listItems = out.filter((s) => s.sourceMeta.kind === 'list_item')
    expect(listItems.map((l) => l.source)).toEqual(['alpha item.', 'beta item.'])

    const codeSegs = out.filter((s) => s.sourceMeta.kind === 'code')
    expect(codeSegs).toHaveLength(1)
    expect(codeSegs[0].source).toBe('const x = 1;\nconst y = 2;')
    expect(codeSegs[0].sourceMeta.lang).toBe('js')

    const quotes = out.filter((s) => s.sourceMeta.kind === 'blockquote')
    expect(quotes.map((q) => q.source)).toEqual(['Quote one.', 'Quote two.'])

    // All kinds appear in document order.
    expect(kinds).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'list_item',
      'list_item',
      'code',
      'blockquote',
      'blockquote',
    ])
  })

  it('skips thematic breaks', () => {
    const out = segment('Para.\n\n---\n\nAnother.', 'md')
    expect(out.map((s) => s.source)).toEqual(['Para.', 'Another.'])
  })

  it('flattens inline marks to plain text', () => {
    const out = segment('A **bold** word and `code` and [link](http://x).', 'md')
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('A bold word and code and link.')
  })

  it('returns empty array for empty markdown', () => {
    expect(segment('', 'md')).toEqual([])
  })
})
