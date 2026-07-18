import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  type LexicalEditor,
} from 'lexical'
import {
  RICH_NAMESPACE,
  getRichNodes,
  richStateToPlain,
  richStateToOriginal,
} from '@/core/editor/richText'
// Importing the node registers it (side effect) for the headless editor.
import '@/features/editor/rich/ChangeMarkNode'
import { $insertSuggestion, $deleteSuggestion } from '@/features/editor/rich/suggest'
import { extractChanges } from '@/core/changes/extract'

const AUTHOR = { authorId: 'a1', authorName: 'Ada' }

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: (e) => {
      throw e
    },
  })
}

function seed(editor: LexicalEditor, text: string) {
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const p = $createParagraphNode()
      if (text) p.append($createTextNode(text))
      root.append(p)
    },
    { discrete: true },
  )
}

function json(editor: LexicalEditor): string {
  return JSON.stringify(editor.getEditorState().toJSON())
}

/** Run `fn` inside an update with the caret placed at `offset` of the first text node. */
function withCaret(editor: LexicalEditor, offset: number, fn: () => void) {
  editor.update(
    () => {
      const p = $getRoot().getFirstChild()
      if ($isElementNode(p)) {
        const t = p.getFirstChild()
        if (t) (t as unknown as { select: (a: number, b: number) => void }).select(offset, offset)
      }
      fn()
    },
    { discrete: true },
  )
}

/** Run `fn` with a range selection [anchor, focus] over the first text node. */
function withRange(editor: LexicalEditor, anchor: number, focus: number, fn: () => void) {
  editor.update(
    () => {
      const p = $getRoot().getFirstChild()
      if ($isElementNode(p)) {
        const t = p.getFirstChild()
        if (t) (t as unknown as { select: (a: number, b: number) => void }).select(anchor, focus)
      }
      fn()
    },
    { discrete: true },
  )
}

describe('$insertSuggestion', () => {
  it('wraps typed text in an insert mark without touching prior text', () => {
    const editor = makeEditor()
    seed(editor, 'hello')
    withCaret(editor, 5, () => $insertSuggestion(' world', AUTHOR))
    const s = json(editor)
    expect(richStateToPlain(s)).toBe('hello world') // proposed includes the insertion
    expect(richStateToOriginal(s)).toBe('hello') // original excludes it
    const changes = extractChanges(s)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ type: 'insert', authorId: 'a1', text: ' world' })
  })

  it('extends the same insert mark when typing continues inside it', () => {
    const editor = makeEditor()
    seed(editor, 'hello')
    withCaret(editor, 5, () => $insertSuggestion(' world', AUTHOR))
    // Caret is left inside the mark; a second insertion must extend it, not fork.
    editor.update(() => $insertSuggestion('!', AUTHOR), { discrete: true })
    const s = json(editor)
    expect(richStateToPlain(s)).toBe('hello world!')
    expect(richStateToOriginal(s)).toBe('hello')
    expect(extractChanges(s)).toHaveLength(1)
  })

  it('replaces a selection: original text deleted, new text inserted', () => {
    const editor = makeEditor()
    seed(editor, 'hello')
    withRange(editor, 0, 5, () => $insertSuggestion('hi', AUTHOR))
    const s = json(editor)
    expect(richStateToPlain(s)).toBe('hi')
    expect(richStateToOriginal(s)).toBe('hello')
    const changes = extractChanges(s)
    expect(changes.map((c) => c.type).sort()).toEqual(['delete', 'insert'])
    expect(changes.find((c) => c.type === 'delete')?.text).toBe('hello')
    expect(changes.find((c) => c.type === 'insert')?.text).toBe('hi')
  })
})

describe('$deleteSuggestion', () => {
  it('marks a selected range deleted without removing the text', () => {
    const editor = makeEditor()
    seed(editor, 'hello world')
    withRange(editor, 0, 5, () => $deleteSuggestion('backward', AUTHOR))
    const s = json(editor)
    expect(richStateToPlain(s)).toBe(' world') // proposed drops the deletion
    expect(richStateToOriginal(s)).toBe('hello world') // original keeps it
    const changes = extractChanges(s)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ type: 'delete', text: 'hello' })
  })

  it('genuinely removes the author’s own pending insertion', () => {
    const editor = makeEditor()
    seed(editor, 'hello')
    withCaret(editor, 5, () => $insertSuggestion(' world', AUTHOR))
    // Select the last two chars of the pending insertion ("ld") and delete them.
    editor.update(
      () => {
        const p = $getRoot().getFirstChild()
        if ($isElementNode(p)) {
          // the insertion mark is the last child; its text node holds " world"
          const mark = p.getLastChild()
          if ($isElementNode(mark)) {
            const t = mark.getFirstChild()
            if (t) (t as unknown as { select: (a: number, b: number) => void }).select(4, 6)
          }
        }
        $deleteSuggestion('backward', AUTHOR)
      },
      { discrete: true },
    )
    const s = json(editor)
    // The own-insertion text ("ld") is really gone; no delete mark is created.
    expect(richStateToPlain(s)).toBe('hello wor')
    expect(richStateToOriginal(s)).toBe('hello')
    const changes = extractChanges(s)
    expect(changes).toHaveLength(1)
    expect(changes[0].type).toBe('insert')
  })
})

// Guard: these helpers never throw on an empty paragraph / no selection edge.
describe('suggest edge cases', () => {
  it('inserting empty text is a no-op that still reports handled', () => {
    const editor = makeEditor()
    seed(editor, 'x')
    let handled = false
    withCaret(editor, 1, () => {
      handled = $insertSuggestion('', AUTHOR)
    })
    expect(handled).toBe(true)
    expect(richStateToPlain(json(editor))).toBe('x')
  })
})
