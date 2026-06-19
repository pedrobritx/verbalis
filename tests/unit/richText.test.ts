import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from 'lexical'
import { richStateToPlain, RICH_NAMESPACE } from '@/core/editor/richText'

function serializeWithText(text: string): string {
  const editor = createEditor({ namespace: RICH_NAMESPACE, onError: () => {} })
  editor.update(
    () => {
      const root = $getRoot()
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode(text))
      root.append(paragraph)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

describe('richStateToPlain', () => {
  it('round-trips plain text through a serialized Lexical state', () => {
    const json = serializeWithText('O Art. 5º garante direitos.')
    expect(richStateToPlain(json)).toBe('O Art. 5º garante direitos.')
  })

  it('returns empty string for missing input', () => {
    expect(richStateToPlain(undefined)).toBe('')
    expect(richStateToPlain('')).toBe('')
  })

  it('returns empty string for unparseable input rather than throwing', () => {
    expect(richStateToPlain('{ not valid lexical json')).toBe('')
  })
})
