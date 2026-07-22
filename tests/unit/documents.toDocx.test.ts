import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { exportProjectDocx, hasPendingForExport } from '@/core/documents/toDocx'
import type { Block } from '@/core/documents/model'
import type { Segment } from '@/core/types'

function seg(o: Partial<Segment> & { id: string; index: number; blockId: string }): Segment {
  return {
    projectId: 'p',
    source: '',
    target: '',
    status: 'untranslated',
    createdAt: 'n',
    updatedAt: 'n',
    sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 0 },
    ...o,
  }
}

function block(o: Partial<Block> & { id: string; index: number }): Block {
  return { documentId: 'd', projectId: 'p', kind: 'paragraph', ...o }
}

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('word/document.xml')!.async('string')
}

describe('exportProjectDocx', () => {
  it('produces a valid .docx with translated text, heading style and bold runs', async () => {
    const blocks = [
      block({ id: 'h', index: 0, kind: 'heading', depth: 1 }),
      block({ id: 'p', index: 1, kind: 'paragraph' }),
    ]
    const boldRich = JSON.stringify({
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Salut.', format: 1 }] }],
      },
    })
    const segments = [
      seg({
        id: 's-h',
        index: 0,
        blockId: 'h',
        source: 'Title',
        target: 'Titre',
        sourceMeta: { kind: 'heading', blockIndex: 0, sentenceIndex: 0 },
      }),
      seg({
        id: 's-p',
        index: 1,
        blockId: 'p',
        source: 'Hi.',
        target: 'Salut.',
        targetRich: boldRich,
        sourceMeta: { kind: 'paragraph', blockIndex: 1, sentenceIndex: 0 },
      }),
    ]

    const blob = await exportProjectDocx(blocks, segments, [])
    const xml = await documentXml(blob)

    expect(xml).toContain('Titre')
    expect(xml).toContain('Salut.')
    expect(xml).toContain('Heading1') // heading style applied
    expect(xml).toContain('<w:b') // the bold run
  })

  it('exports a table with translated cells', async () => {
    const blocks = [
      block({
        id: 't',
        index: 0,
        kind: 'table',
        attrs: { rows: [[[{ text: 'H' }], [{ text: 'X' }]]] },
      }),
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
        source: 'X',
        target: 'Xt',
        sourceMeta: { kind: 'paragraph', blockIndex: 0, sentenceIndex: 1 },
      }),
    ]
    const xml = await documentXml(await exportProjectDocx(blocks, segments, []))
    expect(xml).toContain('<w:tbl')
    expect(xml).toContain('Ht')
    expect(xml).toContain('Xt')
  })

  it('falls back to the source text for untranslated segments', async () => {
    const blocks = [block({ id: 'p', index: 0, kind: 'paragraph' })]
    const segments = [seg({ id: 's', index: 0, blockId: 'p', source: 'Untouched.', target: '' })]
    const xml = await documentXml(await exportProjectDocx(blocks, segments, []))
    expect(xml).toContain('Untouched.')
  })
})

describe('hasPendingForExport', () => {
  it('detects segments with tracked-change marks', () => {
    const withChange = { targetRich: '{"root":{"children":[{"type":"change-mark"}]}}' } as Segment
    const plain = { targetRich: '{"root":{"children":[]}}' } as Segment
    expect(hasPendingForExport([plain, withChange])).toBe(true)
    expect(hasPendingForExport([plain])).toBe(false)
  })
})
