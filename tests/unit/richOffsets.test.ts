import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes } from '@/core/editor/richText'
import { $createInlineTagNode } from '@/features/editor/rich/InlineTagNode'
import { $createChangeMarkNode } from '@/features/editor/rich/ChangeMarkNode'
import { selectionToCaretRange, buildLeafSpans } from '@/features/editor/rich/richOffsets'

/**
 * The reported caret offsets + rendering spans must agree with the plain target
 * `richStateToPlain` derives: a tag contributes `{id}`, a delete change-mark
 * contributes ''. These headless tests build real editor states and assert both.
 */
function headlessEditor(): LexicalEditor {
  return createEditor({ namespace: RICH_NAMESPACE, nodes: getRichNodes(), onError: () => {} })
}

describe('richOffsets: text + inline tag', () => {
  it('reports caret offsets in the same space as the plain projection', () => {
    const editor = headlessEditor()
    let range: unknown
    editor.update(
      () => {
        const para = $createParagraphNode()
        const t1 = $createTextNode('Hello ')
        const tag = $createInlineTagNode('1') // getTextContent → "{1}" (3 chars)
        const t2 = $createTextNode(' wrld')
        para.append(t1, tag, t2)
        $getRoot().append(para)
        // Caret 3 chars into " wrld" → plain 6 + 3 + 3 = 12.
        const sel = $createRangeSelection()
        sel.anchor.set(t2.getKey(), 3, 'text')
        sel.focus.set(t2.getKey(), 3, 'text')
        $setSelection(sel)
      },
      { discrete: true },
    )
    editor.getEditorState().read(() => {
      const s = $getSelection()
      if ($isRangeSelection(s)) range = selectionToCaretRange(s)
    })
    expect(range).toEqual({ anchor: 12, focus: 12 })
  })

  it('builds leaf spans whose lengths match the plain projection', () => {
    const editor = headlessEditor()
    let spans: ReturnType<typeof buildLeafSpans> = []
    let plainLen = 0
    editor.update(
      () => {
        const para = $createParagraphNode()
        para.append($createTextNode('Hello '), $createInlineTagNode('1'), $createTextNode(' wrld'))
        $getRoot().append(para)
      },
      { discrete: true },
    )
    editor.getEditorState().read(() => {
      spans = buildLeafSpans($getRoot().getFirstChild())
      plainLen = $getRoot().getTextContent().length
    })
    expect(spans.map((s) => [s.length, s.isText])).toEqual([
      [6, true],
      [3, false],
      [5, true],
    ])
    expect(spans.reduce((n, s) => n + s.length, 0)).toBe(plainLen)
  })
})

describe('richOffsets: delete change-mark projects to nothing', () => {
  it('skips a delete mark in spans and collapses a caret past it', () => {
    const editor = headlessEditor()
    let spans: ReturnType<typeof buildLeafSpans> = []
    let plainLen = 0
    let caret: unknown
    editor.update(
      () => {
        const para = $createParagraphNode()
        const del = $createChangeMarkNode({
          changeId: 'c1',
          changeType: 'delete',
          authorId: 'a',
          authorName: 'A',
          createdAt: 0,
        })
        del.append($createTextNode('GONE'))
        const tail = $createTextNode('kept')
        para.append($createTextNode('ab'), del, tail)
        $getRoot().append(para)
        // Plain projection is "ab" + "" + "kept" = "abkept" (6). Caret 2 into "kept".
        const sel = $createRangeSelection()
        sel.anchor.set(tail.getKey(), 2, 'text')
        sel.focus.set(tail.getKey(), 2, 'text')
        $setSelection(sel)
      },
      { discrete: true },
    )
    editor.getEditorState().read(() => {
      spans = buildLeafSpans($getRoot().getFirstChild())
      plainLen = $getRoot().getTextContent().length
      const s = $getSelection()
      if ($isRangeSelection(s)) caret = selectionToCaretRange(s)
    })
    expect(plainLen).toBe(6) // "abkept" — the deleted text is not projected
    expect(spans.map((s) => [s.length, s.isText])).toEqual([
      [2, true],
      [4, true],
    ])
    // "ab" (2) + skipped delete (0) + 2 into "kept" = 4.
    expect(caret).toEqual({ anchor: 4, focus: 4 })
  })
})
