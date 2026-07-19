import {
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical'
import { registerRichNode } from '@/core/editor/richText'

// Highlights the text range a comment thread is anchored to (Phase 1.5). Modeled
// as an inline ElementNode that wraps its text children, like LinkNode — so
// getTextContent() passes through unchanged and the derived plain `target` (TM /
// QA / search / export) is unaffected; the anchor is purely presentational. The
// thread itself lives inline on the segment as SegmentComment[]; this node only
// carries the `anchorId` that links a highlight to its root comment.

export type SerializedCommentMarkNode = Spread<
  { type: 'comment-mark'; version: 1; anchorId: string },
  SerializedElementNode
>

export class CommentMarkNode extends ElementNode {
  __anchorId: string

  static getType(): string {
    return 'comment-mark'
  }

  static clone(node: CommentMarkNode): CommentMarkNode {
    return new CommentMarkNode(node.__anchorId, node.__key)
  }

  constructor(anchorId: string, key?: NodeKey) {
    super(key)
    this.__anchorId = anchorId
  }

  getAnchorId(): string {
    return this.getLatest().__anchorId
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rsg-comment'
    span.setAttribute('data-anchor-id', this.__anchorId)
    return span
  }

  updateDOM(prev: CommentMarkNode, dom: HTMLElement): boolean {
    if (prev.__anchorId !== this.__anchorId) {
      dom.setAttribute('data-anchor-id', this.__anchorId)
    }
    return false
  }

  static importJSON(serialized: SerializedCommentMarkNode): CommentMarkNode {
    const node = new CommentMarkNode(serialized.anchorId)
    node.setFormat(serialized.format)
    node.setIndent(serialized.indent)
    node.setDirection(serialized.direction)
    return node
  }

  exportJSON(): SerializedCommentMarkNode {
    return {
      ...super.exportJSON(),
      type: 'comment-mark',
      version: 1,
      anchorId: this.__anchorId,
    }
  }

  isInline(): boolean {
    return true
  }

  canInsertTextBefore(): boolean {
    return true
  }

  canInsertTextAfter(): boolean {
    return true
  }

  // A highlight with no text carries no anchor; let Lexical drop it.
  canBeEmpty(): boolean {
    return false
  }
}

export function $createCommentMarkNode(anchorId: string): CommentMarkNode {
  return new CommentMarkNode(anchorId)
}

export function $isCommentMarkNode(
  node: LexicalNode | null | undefined,
): node is CommentMarkNode {
  return node instanceof CommentMarkNode
}

// Register so the headless richStateToPlain / richStateToOriginal editors can
// parse stored states containing comment marks (side effect on import).
registerRichNode(CommentMarkNode)
