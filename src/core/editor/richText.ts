import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type EditorThemeClasses,
} from 'lexical'

// Shared configuration + serialization helpers for the rich segment editor.
// Lives in core so the plain-text derivation is testable headlessly (no React).

export const RICH_NAMESPACE = 'verbalis-segment'

/** Maps Lexical's built-in text formats to the CSS classes in globals.css. */
export const RICH_THEME: EditorThemeClasses = {
  text: {
    bold: 'rsg-bold',
    italic: 'rsg-italic',
    underline: 'rsg-underline',
    subscript: 'rsg-subscript',
    superscript: 'rsg-superscript',
  },
}

/**
 * Derive plain text from a serialized Lexical state, headlessly. The component
 * computes plain text the same way (`$getRoot().getTextContent()`), so what is
 * stored in `Segment.target` always matches what TM/QA/search see. Returns ''
 * for empty or unparseable input rather than throwing.
 */
export function richStateToPlain(json: string | undefined): string {
  if (!json) return ''
  const editor = createEditor({ namespace: RICH_NAMESPACE, onError: () => {} })
  try {
    const state = editor.parseEditorState(json)
    let text = ''
    state.read(() => {
      text = $getRoot().getTextContent()
    })
    return text
  } catch {
    return ''
  }
}

/**
 * Initial-state builder for LexicalComposer when a segment has no `targetRich`
 * yet: seed a single paragraph from the plain target so the editor opens with
 * the existing translation.
 */
export function prepopulatePlain(text: string): () => void {
  return () => {
    const root = $getRoot()
    if (root.getFirstChild()) return
    const paragraph = $createParagraphNode()
    if (text) paragraph.append($createTextNode(text))
    root.append(paragraph)
  }
}
