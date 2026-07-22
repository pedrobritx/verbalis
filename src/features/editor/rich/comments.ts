import {
  createEditor,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $isElementNode,
  type LexicalNode,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes, richStateToPlain } from '@/core/editor/richText'
import { $createCommentMarkNode, $isCommentMarkNode, CommentMarkNode } from './CommentMarkNode'

/**
 * Comment-anchor helpers (Phase 1.5). Live `$`-helpers run inside an editor
 * update; the headless `removeCommentMark` unwraps an anchor in a serialized
 * `targetRich` for segments that aren't mounted (e.g. resolving from a panel).
 * Removing an anchor never changes the plain `target` (the node wraps text and
 * passes getTextContent through), so TM/QA/search stay stable.
 */

/**
 * Wrap the current (non-collapsed) selection in a comment anchor. Returns the
 * quoted text, or null when there is no range to anchor.
 */
export function $wrapSelectionAsComment(anchorId: string): string | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return null
  const quote = selection.getTextContent()
  const nodes = selection.extract()
  const mark = $createCommentMarkNode(anchorId)
  const first = nodes[0]
  if (!first) return null
  first.insertBefore(mark)
  for (const node of nodes) mark.append(node)
  return quote
}

function $collectCommentMarks(): CommentMarkNode[] {
  const out: CommentMarkNode[] = []
  const walk = (node: LexicalNode) => {
    if ($isCommentMarkNode(node)) out.push(node)
    if ($isElementNode(node)) node.getChildren().forEach(walk)
  }
  $getRoot().getChildren().forEach(walk)
  return out
}

/** Unwrap the comment anchor with the given id (live). Returns whether found. */
export function $removeCommentMarkByAnchor(anchorId: string): boolean {
  const mark = $collectCommentMarks().find((m) => m.getAnchorId() === anchorId)
  if (!mark) return false
  for (const child of mark.getChildren()) mark.insertBefore(child)
  mark.remove()
  return true
}

/**
 * Remove a comment anchor from a serialized `targetRich` headlessly. Returns the
 * new `{ targetRich, target }`, or null if the anchor isn't present / input is
 * unparseable. `target` is recomputed but should equal the input's plain text.
 */
export function removeCommentMark(
  targetRich: string | undefined,
  anchorId: string,
): { targetRich: string; target: string } | null {
  if (!targetRich) return null
  const editor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: () => {},
  })
  let found = false
  try {
    editor.setEditorState(editor.parseEditorState(targetRich))
    editor.update(
      () => {
        found = $removeCommentMarkByAnchor(anchorId)
      },
      { discrete: true },
    )
  } catch {
    return null
  }
  if (!found) return null
  const rich = JSON.stringify(editor.getEditorState().toJSON())
  return { targetRich: rich, target: richStateToPlain(rich) }
}
