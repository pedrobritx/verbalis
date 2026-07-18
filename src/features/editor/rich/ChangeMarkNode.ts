import {
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical'
import { registerRichNode } from '@/core/editor/richText'
import { colorForAuthor } from '@/core/history/authorColor'
import type { ChangeType } from '@/core/changes/model'

// A tracked-change mark in the rich segment editor (ROADMAP §3 D1–D3). Modeled as
// an inline ElementNode that *wraps* editable text children, exactly like LinkNode.
// The change metadata lives in the node's attributes — there is no parallel store.
//
// The load-bearing trick (D2): `getTextContent()` returns '' for a `delete` mark,
// so the derived plain `target` — what TM, QA, search and export consume — reflects
// the *proposed* text (pending insertions in, pending deletions out) automatically,
// in both the live editor (`$getRoot().getTextContent()`) and the headless
// `richStateToPlain`. The inverse projection for diffing lives in
// `richStateToOriginal` (src/core/editor/richText.ts).

export type SerializedChangeMarkNode = Spread<
  {
    type: 'change-mark'
    version: 1
    changeId: string
    changeType: ChangeType
    authorId: string
    authorName: string
    createdAt: number
  },
  SerializedElementNode
>

export interface ChangeMarkAttrs {
  changeId: string
  changeType: ChangeType
  authorId: string
  authorName: string
  createdAt: number
}

export class ChangeMarkNode extends ElementNode {
  __changeId: string
  __changeType: ChangeType
  __authorId: string
  __authorName: string
  __createdAt: number

  static getType(): string {
    return 'change-mark'
  }

  static clone(node: ChangeMarkNode): ChangeMarkNode {
    return new ChangeMarkNode(
      {
        changeId: node.__changeId,
        changeType: node.__changeType,
        authorId: node.__authorId,
        authorName: node.__authorName,
        createdAt: node.__createdAt,
      },
      node.__key,
    )
  }

  constructor(attrs: ChangeMarkAttrs, key?: NodeKey) {
    super(key)
    this.__changeId = attrs.changeId
    this.__changeType = attrs.changeType
    this.__authorId = attrs.authorId
    this.__authorName = attrs.authorName
    this.__createdAt = attrs.createdAt
  }

  getChangeId(): string {
    return this.getLatest().__changeId
  }

  getChangeType(): ChangeType {
    return this.getLatest().__changeType
  }

  getAuthorId(): string {
    return this.getLatest().__authorId
  }

  getAuthorName(): string {
    return this.getLatest().__authorName
  }

  getCreatedAt(): number {
    return this.getLatest().__createdAt
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span')
    this.applyStyle(span)
    return span
  }

  updateDOM(prev: ChangeMarkNode, dom: HTMLElement): boolean {
    if (prev.__changeType !== this.__changeType || prev.__authorName !== this.__authorName) {
      this.applyStyle(dom)
    }
    return false
  }

  private applyStyle(dom: HTMLElement): void {
    dom.className = this.__changeType === 'delete' ? 'rsg-change-del' : 'rsg-change-ins'
    dom.style.setProperty('--rsg-change-color', colorForAuthor(this.__authorName))
    dom.setAttribute('data-change-id', this.__changeId)
    dom.setAttribute('data-change-type', this.__changeType)
    dom.setAttribute('data-change-author', this.__authorId)
    const verb = this.__changeType === 'delete' ? 'Deletion' : 'Insertion'
    dom.title = this.__authorName ? `${verb} by ${this.__authorName}` : verb
  }

  static importJSON(serialized: SerializedChangeMarkNode): ChangeMarkNode {
    const node = new ChangeMarkNode({
      changeId: serialized.changeId,
      changeType: serialized.changeType,
      authorId: serialized.authorId,
      authorName: serialized.authorName,
      createdAt: serialized.createdAt,
    })
    node.setFormat(serialized.format)
    node.setIndent(serialized.indent)
    node.setDirection(serialized.direction)
    return node
  }

  exportJSON(): SerializedChangeMarkNode {
    return {
      ...super.exportJSON(),
      type: 'change-mark',
      version: 1,
      changeId: this.__changeId,
      changeType: this.__changeType,
      authorId: this.__authorId,
      authorName: this.__authorName,
      createdAt: this.__createdAt,
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

  // An emptied change mark carries no suggestion; let Lexical remove it.
  canBeEmpty(): boolean {
    return false
  }

  /**
   * D2 plain-text semantics: a pending deletion contributes nothing to the
   * proposed text; a pending insertion contributes its wrapped text as usual.
   */
  getTextContent(): string {
    return this.__changeType === 'delete' ? '' : super.getTextContent()
  }
}

export function $createChangeMarkNode(attrs: ChangeMarkAttrs): ChangeMarkNode {
  return new ChangeMarkNode(attrs)
}

export function $isChangeMarkNode(
  node: LexicalNode | null | undefined,
): node is ChangeMarkNode {
  return node instanceof ChangeMarkNode
}

// Register so the headless `richStateToPlain`/`richStateToOriginal` editors can
// parse stored states that contain change marks (side effect on import, matching
// InlineTagNode/LinkNode). RichSegmentEditor and the contract tests import this
// module, guaranteeing registration before any parse.
registerRichNode(ChangeMarkNode)
