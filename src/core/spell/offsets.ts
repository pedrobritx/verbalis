// Map a misspelled token's plain-text offsets onto the rich editor's DOM. The
// rich editor mixes editable TextNodes with atomic InlineTagNodes that render as
// chips: a tag contributes `{id}` to the plain text (so token offsets shift past
// it) but holds no editable DOM text. This pure helper turns plain-text token
// ranges into per-node local ranges so the overlay can build a DOM Range on the
// right text node. Pure + headlessly unit-tested; the DOM measurement lives in
// the plugin.

export interface NodeSpan {
  /** Lexical node key, for editor.getElementByKey at paint time. */
  key: string
  /** Length of this node's contribution to the plain text. */
  length: number
  /** Only text nodes carry editable DOM text we can range over. */
  isText: boolean
}

export interface MappedRange {
  key: string
  localStart: number
  localEnd: number
}

/**
 * Locate `[start, end)` within the ordered node spans. Returns the containing
 * text node with node-local offsets, or null when the token lands in / spans a
 * non-text node or crosses a node boundary (skip — don't underline).
 */
export function mapTokenToNode(
  spans: NodeSpan[],
  start: number,
  end: number,
): MappedRange | null {
  if (end <= start) return null
  let offset = 0
  for (const span of spans) {
    const spanEnd = offset + span.length
    if (start >= offset && end <= spanEnd) {
      if (!span.isText) return null
      return { key: span.key, localStart: start - offset, localEnd: end - offset }
    }
    // Token starts inside this span but extends beyond it → crosses a boundary.
    if (start >= offset && start < spanEnd) return null
    offset = spanEnd
  }
  return null
}
