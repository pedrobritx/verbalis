import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isElementNode,
  $createTextNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical'
import { createChangeId, type ChangeType } from '@/core/changes/model'
import { $createChangeMarkNode, $isChangeMarkNode, ChangeMarkNode } from './ChangeMarkNode'

/**
 * Lexical `$`-helpers that turn edits into tracked suggestions (ROADMAP §3
 * D1–D3). These must run inside an `editor.update()` and mirror how the direct
 * editor would apply an edit — except:
 *  - typed text is wrapped in an `insert` ChangeMarkNode (or extends an adjacent
 *    same-author insertion), so nothing prior is overwritten;
 *  - deletions wrap the target text in a `delete` ChangeMarkNode instead of
 *    removing it — unless the text is the local author's own pending insertion,
 *    which is genuinely removed.
 *
 * Lives beside ChangeMarkNode (not in core/) because it constructs that
 * feature-layer node; the logic is still pure and headlessly unit-tested.
 */

export interface SuggestionAuthor {
  authorId: string
  authorName: string
}

/** The nearest enclosing ChangeMarkNode of `node`, if any. */
function $changeMarkAncestor(node: LexicalNode | null): ChangeMarkNode | null {
  let n: LexicalNode | null = node
  while (n) {
    if ($isChangeMarkNode(n)) return n
    n = n.getParent()
  }
  return null
}

function newMark(type: ChangeType, author: SuggestionAuthor): ChangeMarkNode {
  return $createChangeMarkNode({
    changeId: createChangeId(),
    changeType: type,
    authorId: author.authorId,
    authorName: author.authorName,
    createdAt: Date.now(),
  })
}

/** True when `mark` is a pending insertion owned by `author`. */
function isOwnInsert(mark: ChangeMarkNode | null, author: SuggestionAuthor): boolean {
  return (
    !!mark && mark.getChangeType() === 'insert' && mark.getAuthorId() === author.authorId
  )
}

/**
 * Insert `text` as a suggestion at the current selection. A non-collapsed
 * selection is first marked deleted (replace semantics), then the text is
 * inserted at the caret. Returns true when handled.
 */
export function $insertSuggestion(text: string, author: SuggestionAuthor): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  if (!text) return true

  if (!selection.isCollapsed()) {
    $markRangeDeleted(selection, 'backward', author)
  }

  const sel = $getSelection()
  if (!$isRangeSelection(sel)) return false

  const anchorNode = sel.anchor.getNode()
  const enclosing = $changeMarkAncestor(anchorNode)

  // Caret already inside the author's own pending insertion → just extend it.
  if (isOwnInsert(enclosing, author)) {
    sel.insertText(text)
    return true
  }

  // Caret adjacent to the author's own pending insertion → extend it rather than
  // starting a fragmented second mark.
  const adjacent = $adjacentOwnInsert(sel, author)
  if (adjacent) {
    const child = adjacent.mark.getLastChild()
    if (adjacent.side === 'after' && $isTextNode(child)) {
      const tn = $createTextNode(text)
      child.insertAfter(tn)
      tn.selectEnd()
      return true
    }
    const first = adjacent.mark.getFirstChild()
    if (adjacent.side === 'before' && $isTextNode(first)) {
      const tn = $createTextNode(text)
      first.insertBefore(tn)
      tn.selectEnd()
      return true
    }
  }

  // Otherwise start a fresh insertion mark and leave the caret inside it so
  // continued typing extends the same mark.
  const mark = newMark('insert', author)
  const tn = $createTextNode(text)
  mark.append(tn)
  sel.insertNodes([mark])
  tn.selectEnd()
  return true
}

/**
 * Detect a caret sitting immediately before/after the author's own pending
 * insertion mark (in a sibling position), so a new keystroke can extend it.
 */
function $adjacentOwnInsert(
  selection: RangeSelection,
  author: SuggestionAuthor,
): { mark: ChangeMarkNode; side: 'before' | 'after' } | null {
  const node = selection.anchor.getNode()
  const offset = selection.anchor.offset
  if ($isTextNode(node)) {
    if (offset === 0) {
      const prev = node.getPreviousSibling()
      if (isOwnInsert($isChangeMarkNode(prev) ? prev : null, author))
        return { mark: prev as ChangeMarkNode, side: 'after' }
    }
    if (offset === node.getTextContentSize()) {
      const next = node.getNextSibling()
      if (isOwnInsert($isChangeMarkNode(next) ? next : null, author))
        return { mark: next as ChangeMarkNode, side: 'before' }
    }
    return null
  }
  if ($isElementNode(node)) {
    const before = node.getChildAtIndex(offset - 1)
    if (isOwnInsert($isChangeMarkNode(before) ? before : null, author))
      return { mark: before as ChangeMarkNode, side: 'after' }
    const after = node.getChildAtIndex(offset)
    if (isOwnInsert($isChangeMarkNode(after) ? after : null, author))
      return { mark: after as ChangeMarkNode, side: 'before' }
  }
  return null
}

/**
 * Delete a character (collapsed caret) or the current range as a suggestion.
 * `direction` matters only for a collapsed caret (Backspace vs Delete). Returns
 * true when handled (always, in suggesting mode, so the default is prevented).
 */
export function $deleteSuggestion(
  direction: 'backward' | 'forward',
  author: SuggestionAuthor,
): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  if (selection.isCollapsed()) {
    // Grow the caret to cover one character in the delete direction, crossing
    // node boundaries the way the native editor would.
    selection.modify('extend', direction === 'backward', 'character')
    if (selection.isCollapsed()) return true // at a boundary — nothing to delete
  }
  $markRangeDeleted(selection, direction, author)
  return true
}

/**
 * Wrap every text slice in the selection in a `delete` mark, except the author's
 * own pending insertions (removed outright) and already-deleted text (left as
 * is). The caret is placed just outside the affected region so repeated presses
 * continue past it.
 */
function $markRangeDeleted(
  selection: RangeSelection,
  direction: 'backward' | 'forward',
  author: SuggestionAuthor,
): void {
  // `extract()` splits partially-selected text nodes and returns the slices that
  // lie fully inside the selection.
  const nodes = selection.extract()
  let firstMark: LexicalNode | null = null
  let lastMark: LexicalNode | null = null

  for (const node of nodes) {
    if (!$isTextNode(node) && !$isChangeMarkNode(node)) continue
    const enclosing = $changeMarkAncestor(node)

    if (enclosing && isOwnInsert(enclosing, author)) {
      // The author's own not-yet-accepted insertion — genuinely remove it.
      node.remove()
      if (!enclosing.getFirstChild()) enclosing.remove()
      continue
    }
    if (enclosing && enclosing.getChangeType() === 'delete') {
      // Already marked deleted — keep it, just track the boundary for the caret.
      if (!firstMark) firstMark = enclosing
      lastMark = enclosing
      continue
    }

    // Plain text (or another author's insertion): wrap the slice in a delete mark.
    const mark = newMark('delete', author)
    node.insertBefore(mark)
    mark.append(node)
    if (!firstMark) firstMark = mark
    lastMark = mark
  }

  if (direction === 'backward' && firstMark) firstMark.selectPrevious()
  else if (lastMark) lastMark.selectNext()
}
