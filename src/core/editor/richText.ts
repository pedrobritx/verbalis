import {
  createEditor,
  $getRoot,
  type EditorThemeClasses,
  type Klass,
  type LexicalNode,
} from 'lexical'

// Shared configuration + serialization helpers for the rich segment editor.
// Lives in core so the plain-text derivation is testable headlessly (no React).

export const RICH_NAMESPACE = 'verbalis-segment'

// Custom Lexical nodes (e.g. InlineTagNode) register themselves here at import
// time so the headless `richStateToPlain` editor can parse a `targetRich` that
// contains them — otherwise `parseEditorState` throws on the unknown node type
// and plain text is silently lost. The node lives in the features layer (it has
// a React decoration); this seam keeps core from importing it directly.
const richNodes: Array<Klass<LexicalNode>> = []

export function registerRichNode(node: Klass<LexicalNode>): void {
  if (!richNodes.includes(node)) richNodes.push(node)
}

/** The custom nodes registered so far — used by both the live and headless editors. */
export function getRichNodes(): Array<Klass<LexicalNode>> {
  return richNodes
}

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
  const editor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: richNodes,
    onError: () => {},
  })
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
