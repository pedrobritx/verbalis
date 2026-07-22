import { DecoratorNode, type DOMConversionMap, type LexicalNode, type NodeKey } from 'lexical'
import { registerRichNode } from '@/core/editor/richText'
import { type InlineTagKind } from '@/core/bilingual/inlineTags'
import { InlineTagChip } from './InlineTagChip'

// A Lexical decorator node for an XLIFF inline tag, rendered as an atomic chip.
// The translator cannot edit its insides; it is inserted, moved or deleted as a
// single unit. Crucially `getTextContent()` returns the numeric placeholder
// `{id}`, so the derived plain `target` stays byte-for-byte what TM, QA, search
// and XLIFF export already expect — the rich layer is purely presentational.

export interface SerializedInlineTagNode {
  type: 'inline-tag'
  version: 1
  tagId: string
  kind: InlineTagKind
}

export class InlineTagNode extends DecoratorNode<JSX.Element> {
  __tagId: string
  __kind: InlineTagKind

  static getType(): string {
    return 'inline-tag'
  }

  static clone(node: InlineTagNode): InlineTagNode {
    return new InlineTagNode(node.__tagId, node.__kind, node.__key)
  }

  constructor(tagId: string, kind: InlineTagKind = 'generic', key?: NodeKey) {
    super(key)
    this.__tagId = tagId
    this.__kind = kind
  }

  static importJSON(serialized: SerializedInlineTagNode): InlineTagNode {
    return new InlineTagNode(serialized.tagId, serialized.kind ?? 'generic')
  }

  exportJSON(): SerializedInlineTagNode {
    return { type: 'inline-tag', version: 1, tagId: this.__tagId, kind: this.__kind }
  }

  // No DOM import: pasted `{id}` arrives as text and is left as text (it still
  // serializes and exports correctly). Chip-ification on paste is a later refinement.
  static importDOM(): DOMConversionMap | null {
    return null
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.style.display = 'inline-block'
    return span
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return true
  }

  isKeyboardSelectable(): boolean {
    return true
  }

  /** The contract: the plain-text projection of this node is its placeholder. */
  getTextContent(): string {
    return `{${this.__tagId}}`
  }

  decorate(): JSX.Element {
    return <InlineTagChip id={this.__tagId} kind={this.__kind} />
  }
}

export function $createInlineTagNode(
  tagId: string,
  kind: InlineTagKind = 'generic',
): InlineTagNode {
  return new InlineTagNode(tagId, kind)
}

export function $isInlineTagNode(node: LexicalNode | null | undefined): node is InlineTagNode {
  return node instanceof InlineTagNode
}

// Register so the headless `richStateToPlain` editor can parse stored states
// that contain inline-tag nodes. Side-effect on import — RichSegmentEditor and
// the contract test import this module, guaranteeing registration before use.
registerRichNode(InlineTagNode)
