import { describe, it, expect } from 'vitest'
import { targetRichToRuns } from '@/core/documents/targetRuns'

function state(children: unknown[]): string {
  return JSON.stringify({ root: { type: 'root', children: [{ type: 'paragraph', children }] } })
}

describe('targetRichToRuns', () => {
  it('decodes Lexical text-format flags into run formatting', () => {
    const json = state([
      { type: 'text', text: 'plain ', format: 0 },
      { type: 'text', text: 'bold', format: 1 },
      { type: 'text', text: 'it', format: 2 },
      { type: 'text', text: 'u', format: 8 },
      { type: 'text', text: 'sub', format: 32 },
      { type: 'text', text: 'sup', format: 64 },
    ])
    expect(targetRichToRuns(json)).toEqual([
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: 'it', italic: true },
      { text: 'u', underline: true },
      { text: 'sub', sub: true },
      { text: 'sup', sup: true },
    ])
  })

  it('applies accepted-preview to tracked changes (insertions kept, deletions dropped)', () => {
    const json = state([
      { type: 'text', text: 'keep ', format: 0 },
      {
        type: 'change-mark',
        changeType: 'delete',
        children: [{ type: 'text', text: 'gone', format: 0 }],
      },
      {
        type: 'change-mark',
        changeType: 'insert',
        children: [{ type: 'text', text: 'added', format: 0 }],
      },
    ])
    expect(targetRichToRuns(json)).toEqual([{ text: 'keep added' }])
  })

  it('carries hyperlink href onto its runs and renders inline-tag placeholders', () => {
    const json = state([
      { type: 'link', url: 'https://x', children: [{ type: 'text', text: 'site', format: 1 }] },
      { type: 'text', text: ' ', format: 0 },
      { type: 'inline-tag', tagId: '1' },
    ])
    // The unformatted space and the inline-tag placeholder merge into one run.
    expect(targetRichToRuns(json)).toEqual([
      { text: 'site', bold: true, href: 'https://x' },
      { text: ' {1}' },
    ])
  })

  it('returns [] for missing or unparseable input', () => {
    expect(targetRichToRuns(undefined)).toEqual([])
    expect(targetRichToRuns('{ not json')).toEqual([])
  })
})
