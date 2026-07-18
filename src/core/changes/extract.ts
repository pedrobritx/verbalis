import type { ChangeType, TrackedChange } from './model'

// Pure reader for tracked changes (ROADMAP §3 D3). Walks a serialized `targetRich`
// Lexical state as plain JSON — no editor instance — so project-wide panels can
// list pending suggestions across many unmounted segments cheaply. Kept in core
// so it is headlessly testable and free of any React/Lexical-runtime dependency.

/** A tracked change plus the underlying text it wraps. */
export interface ExtractedChange extends TrackedChange {
  /** The change's own text: inserted text, or the text marked for deletion. */
  text: string
}

interface RichNode {
  type?: string
  text?: string
  tagId?: string
  changeId?: string
  changeType?: ChangeType
  authorId?: string
  authorName?: string
  createdAt?: number
  children?: RichNode[]
}

/** The plain-text projection of a node subtree (mirrors the node getTextContent). */
function textOf(node: RichNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'tab') return '\t'
  if (node.type === 'inline-tag') return `{${node.tagId ?? ''}}`
  if (!node.children) return ''
  return node.children.map(textOf).join('')
}

function collect(node: RichNode, out: ExtractedChange[]): void {
  if (
    node.type === 'change-mark' &&
    typeof node.changeId === 'string' &&
    (node.changeType === 'insert' || node.changeType === 'delete')
  ) {
    out.push({
      id: node.changeId,
      type: node.changeType,
      authorId: node.authorId ?? '',
      authorName: node.authorName ?? '',
      createdAt: node.createdAt ?? 0,
      text: node.children ? node.children.map(textOf).join('') : '',
    })
  }
  if (node.children) for (const child of node.children) collect(child, out)
}

/**
 * List every pending change in a segment's `targetRich`, in document order.
 * Returns `[]` for empty or unparseable input rather than throwing.
 */
export function extractChanges(targetRich: string | undefined): ExtractedChange[] {
  if (!targetRich) return []
  let root: RichNode | undefined
  try {
    root = (JSON.parse(targetRich) as { root?: RichNode }).root
  } catch {
    return []
  }
  if (!root) return []
  const out: ExtractedChange[] = []
  collect(root, out)
  return out
}

/** True when a segment has any pending suggestion (the confirm-gate predicate). */
export function hasPendingChanges(targetRich: string | undefined): boolean {
  return extractChanges(targetRich).length > 0
}
