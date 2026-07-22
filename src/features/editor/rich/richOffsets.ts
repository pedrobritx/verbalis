import { $getRoot, $isTextNode, type LexicalNode, type Point, type RangeSelection } from 'lexical'
import type { NodeSpan } from '@/core/spell/offsets'
import type { CaretRange } from '@/storage/sync/presence'

/**
 * Map between a Lexical selection and plain-text offsets for remote caret
 * rendering (ROADMAP §4.4.1). Both directions must agree with the plain target
 * that `richStateToPlain` derives (`$getRoot().getTextContent()`): a tag chip
 * contributes its `{id}` placeholder, and a `delete` change-mark projects to ''.
 * These helpers reproduce exactly that projection so a caret offset reported by
 * one peer lands on the same character in another peer's editor. Must run inside
 * an `editor.getEditorState().read()` — Lexical nodes are only valid there.
 */

function childrenOf(node: LexicalNode): LexicalNode[] {
  const getChildren = (node as { getChildren?: () => LexicalNode[] }).getChildren
  return typeof getChildren === 'function' ? getChildren.call(node) : []
}

/** Plain-text offset of `point` within `node`'s projection, or null if outside it. */
function offsetWithin(node: LexicalNode, point: Point): number | null {
  if ($isTextNode(node)) {
    if (node.getKey() === point.key) return Math.min(point.offset, node.getTextContent().length)
    return null
  }
  const kids = childrenOf(node)
  if (node.getKey() === point.key) {
    // Element point: `offset` is a child index → sum the plain text before it.
    let acc = 0
    for (let i = 0; i < point.offset && i < kids.length; i += 1)
      acc += kids[i].getTextContent().length
    return acc
  }
  if (kids.length === 0) return null // atomic node (tag / line break), point not on it
  // A node that projects to '' (a delete change-mark) collapses any inner point
  // to its start, matching the plain text where its content does not appear.
  const projectsEmpty = node.getTextContent() === ''
  let acc = 0
  for (const kid of kids) {
    const inner = offsetWithin(kid, point)
    if (inner !== null) return projectsEmpty ? 0 : acc + inner
    acc += kid.getTextContent().length
  }
  return null
}

/** Convert a live range selection to plain-text anchor/focus offsets. */
export function selectionToCaretRange(selection: RangeSelection): CaretRange {
  const para = $getRoot().getFirstChild()
  const toOffset = (point: Point): number => {
    if (!para) return 0
    return offsetWithin(para, point) ?? para.getTextContent().length
  }
  return { anchor: toOffset(selection.anchor), focus: toOffset(selection.focus) }
}

/**
 * Ordered leaf spans of the segment's single paragraph with their plain-text
 * lengths, built so their lengths sum to the plain target — text nodes and
 * atomic nodes (tags, line breaks) become spans; a delete change-mark's subtree
 * is skipped (it projects to ''). Mirrors {@link selectionToCaretRange}, so
 * `mapOffsetToNode` resolves a reported caret offset to the right text node.
 */
export function buildLeafSpans(node: LexicalNode | null): NodeSpan[] {
  if (!node) return []
  if ($isTextNode(node)) {
    return [{ key: node.getKey(), length: node.getTextContent().length, isText: true }]
  }
  const kids = childrenOf(node)
  if (kids.length === 0) {
    return [{ key: node.getKey(), length: node.getTextContent().length, isText: false }]
  }
  if (node.getTextContent() === '') return [] // delete change-mark: contributes nothing
  return kids.flatMap(buildLeafSpans)
}
