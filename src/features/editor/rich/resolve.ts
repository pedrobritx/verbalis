import {
  createEditor,
  $getRoot,
  $isElementNode,
  type LexicalNode,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes, richStateToPlain } from '@/core/editor/richText'
import { $isChangeMarkNode, ChangeMarkNode } from './ChangeMarkNode'

/**
 * Accept/reject helpers for tracked changes (ROADMAP §3, Phase 1.4).
 *  - accept insert / reject delete → keep the wrapped text (unwrap the mark)
 *  - accept delete / reject insert → drop the wrapped text (remove the mark)
 *
 * A headless `resolveChangeInRich` applies a resolution to a serialized
 * `targetRich` (for segments not currently mounted), returning the new
 * `{ targetRich, target }`; the `$`-helpers run inside a live editor update.
 * Lives beside ChangeMarkNode because it manipulates that node; still pure.
 */

export type ResolveAction = 'accept' | 'reject'

/** Whether the wrapped text survives this resolution. */
function keepsText(type: 'insert' | 'delete', action: ResolveAction): boolean {
  return (type === 'insert' && action === 'accept') || (type === 'delete' && action === 'reject')
}

/** Apply a resolution to a single change mark (in an active editor state). */
export function $resolveChangeMark(mark: ChangeMarkNode, action: ResolveAction): void {
  if (keepsText(mark.getChangeType(), action)) {
    // Unwrap: move the children out before the mark, then remove the wrapper.
    for (const child of mark.getChildren()) mark.insertBefore(child)
  }
  mark.remove()
}

/** Every change mark in the document, in order. */
export function $collectChangeMarks(): ChangeMarkNode[] {
  const out: ChangeMarkNode[] = []
  const walk = (node: LexicalNode) => {
    if ($isChangeMarkNode(node)) out.push(node)
    if ($isElementNode(node)) node.getChildren().forEach(walk)
  }
  $getRoot().getChildren().forEach(walk)
  return out
}

/** Resolve a single change by id. Returns false when no such change exists. */
export function $resolveChangeById(changeId: string, action: ResolveAction): boolean {
  const mark = $collectChangeMarks().find((m) => m.getChangeId() === changeId)
  if (!mark) return false
  $resolveChangeMark(mark, action)
  return true
}

/** Resolve every pending change with one action. Returns how many were resolved. */
export function $resolveAllChanges(action: ResolveAction): number {
  const marks = $collectChangeMarks()
  for (const m of marks) $resolveChangeMark(m, action)
  return marks.length
}

function headlessEditor() {
  return createEditor({ namespace: RICH_NAMESPACE, nodes: getRichNodes(), onError: () => {} })
}

function serialize(editor: ReturnType<typeof headlessEditor>) {
  const targetRich = JSON.stringify(editor.getEditorState().toJSON())
  return { targetRich, target: richStateToPlain(targetRich) }
}

/**
 * Apply a resolution to a serialized `targetRich` headlessly. Returns the new
 * `{ targetRich, target }`, or null if the change id isn't present or the input
 * can't be parsed.
 */
export function resolveChangeInRich(
  targetRich: string | undefined,
  changeId: string,
  action: ResolveAction,
): { targetRich: string; target: string } | null {
  if (!targetRich) return null
  const editor = headlessEditor()
  let found = false
  try {
    editor.setEditorState(editor.parseEditorState(targetRich))
    editor.update(
      () => {
        found = $resolveChangeById(changeId, action)
      },
      { discrete: true },
    )
  } catch {
    return null
  }
  return found ? serialize(editor) : null
}

/**
 * Resolve every pending change in a serialized `targetRich` with one action.
 * Returns the new `{ targetRich, target, count }`, or null on parse failure.
 */
export function resolveAllInRich(
  targetRich: string | undefined,
  action: ResolveAction,
): { targetRich: string; target: string; count: number } | null {
  if (!targetRich) return null
  const editor = headlessEditor()
  let count = 0
  try {
    editor.setEditorState(editor.parseEditorState(targetRich))
    editor.update(
      () => {
        count = $resolveAllChanges(action)
      },
      { discrete: true },
    )
  } catch {
    return null
  }
  if (count === 0) return null
  return { ...serialize(editor), count }
}
