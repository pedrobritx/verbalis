import {
  ElementNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical'
import { registerRichNode } from '@/core/editor/richText'

// A hyperlink in the rich segment editor. Modeled as an inline ElementNode (like
// @lexical/link's LinkNode) so it *wraps* editable text children: `getTextContent()`
// therefore returns the visible link text, keeping the derived plain `target` —
// what TM, QA, search and XLIFF export consume — unchanged. The URL lives only in
// the presentational `targetRich` state.

export type SerializedLinkNode = Spread<
  { type: 'link'; version: 1; url: string },
  SerializedElementNode
>

export class LinkNode extends ElementNode {
  __url: string

  static getType(): string {
    return 'link'
  }

  static clone(node: LinkNode): LinkNode {
    return new LinkNode(node.__url, node.__key)
  }

  constructor(url: string, key?: NodeKey) {
    super(key)
    this.__url = url
  }

  getURL(): string {
    return this.getLatest().__url
  }

  setURL(url: string): void {
    this.getWritable().__url = url
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const a = document.createElement('a')
    a.href = this.__url
    a.className = 'rsg-link'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    return a
  }

  updateDOM(prevNode: LinkNode, dom: HTMLElement): boolean {
    if (prevNode.__url !== this.__url && dom instanceof HTMLAnchorElement) {
      dom.href = this.__url
    }
    return false
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: () => ({
        conversion: (el: HTMLElement): DOMConversionOutput => {
          const href = el instanceof HTMLAnchorElement ? el.href : ''
          return { node: new LinkNode(href) }
        },
        priority: 1,
      }),
    }
  }

  static importJSON(serialized: SerializedLinkNode): LinkNode {
    const node = new LinkNode(serialized.url)
    node.setFormat(serialized.format)
    node.setIndent(serialized.indent)
    node.setDirection(serialized.direction)
    return node
  }

  exportJSON(): SerializedLinkNode {
    return {
      ...super.exportJSON(),
      type: 'link',
      version: 1,
      url: this.__url,
    }
  }

  isInline(): boolean {
    return true
  }

  // Allow typing immediately before/after the link so the caret isn't trapped.
  canInsertTextBefore(): boolean {
    return true
  }

  canInsertTextAfter(): boolean {
    return true
  }

  // A link must keep its text; collapsing to empty should remove it instead.
  canBeEmpty(): boolean {
    return false
  }
}

export function $createLinkNode(url: string): LinkNode {
  return new LinkNode(url)
}

export function $isLinkNode(node: LexicalNode | null | undefined): node is LinkNode {
  return node instanceof LinkNode
}

// Register so the headless `richStateToPlain` editor can parse stored states that
// contain link nodes (otherwise plain-text derivation would silently drop them).
registerRichNode(LinkNode)
