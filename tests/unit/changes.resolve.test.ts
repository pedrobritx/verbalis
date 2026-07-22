import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes } from '@/core/editor/richText'
import '@/features/editor/rich/ChangeMarkNode'
import { $createChangeMarkNode } from '@/features/editor/rich/ChangeMarkNode'
import { resolveChangeInRich, resolveAllInRich } from '@/features/editor/rich/resolve'
import { extractChanges } from '@/core/changes/extract'

const AUTHOR = { authorId: 'a1', authorName: 'Ada' }

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: (e) => {
      throw e
    },
  })
}

/**
 * Build "Keep [+ins] and [-del] tail": a paragraph with one insert mark ("ins")
 * and one delete mark ("del"), and return the serialized targetRich.
 */
function buildWithChanges(): { rich: string; insId: string; delId: string } {
  const editor = makeEditor()
  const insId = 'c-ins'
  const delId = 'c-del'
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const p = $createParagraphNode()
      p.append($createTextNode('Keep '))
      const ins = $createChangeMarkNode({
        changeId: insId,
        changeType: 'insert',
        authorId: AUTHOR.authorId,
        authorName: AUTHOR.authorName,
        createdAt: 1,
      })
      ins.append($createTextNode('ins'))
      p.append(ins)
      p.append($createTextNode(' and '))
      const del = $createChangeMarkNode({
        changeId: delId,
        changeType: 'delete',
        authorId: AUTHOR.authorId,
        authorName: AUTHOR.authorName,
        createdAt: 2,
      })
      del.append($createTextNode('del'))
      p.append(del)
      p.append($createTextNode(' tail'))
      root.append(p)
    },
    { discrete: true },
  )
  return { rich: JSON.stringify(editor.getEditorState().toJSON()), insId, delId }
}

describe('resolveChangeInRich', () => {
  it('accept insertion keeps the text and clears the mark', () => {
    const { rich, insId } = buildWithChanges()
    const out = resolveChangeInRich(rich, insId, 'accept')!
    expect(out.target).toBe('Keep ins and  tail') // insertion kept, deletion still dropped
    const remaining = extractChanges(out.targetRich)
    expect(remaining.map((c) => c.id)).toEqual(['c-del']) // only the deletion remains pending
  })

  it('reject insertion removes the text', () => {
    const { rich, insId } = buildWithChanges()
    const out = resolveChangeInRich(rich, insId, 'reject')!
    expect(out.target).toBe('Keep  and  tail')
    expect(extractChanges(out.targetRich).map((c) => c.id)).toEqual(['c-del'])
  })

  it('accept deletion removes the text', () => {
    const { rich, delId } = buildWithChanges()
    const out = resolveChangeInRich(rich, delId, 'accept')!
    // Insertion still pending (its text present); deletion applied (text gone).
    expect(out.target).toBe('Keep ins and  tail')
    expect(extractChanges(out.targetRich).map((c) => c.id)).toEqual(['c-ins'])
  })

  it('reject deletion keeps the text', () => {
    const { rich, delId } = buildWithChanges()
    const out = resolveChangeInRich(rich, delId, 'reject')!
    expect(out.target).toBe('Keep ins and del tail')
    expect(extractChanges(out.targetRich).map((c) => c.id)).toEqual(['c-ins'])
  })

  it('returns null for an unknown change id or missing input', () => {
    const { rich } = buildWithChanges()
    expect(resolveChangeInRich(rich, 'nope', 'accept')).toBeNull()
    expect(resolveChangeInRich(undefined, 'x', 'accept')).toBeNull()
  })
})

describe('resolveAllInRich', () => {
  it('accept all keeps insertions and applies deletions', () => {
    const { rich } = buildWithChanges()
    const out = resolveAllInRich(rich, 'accept')!
    expect(out.count).toBe(2)
    expect(out.target).toBe('Keep ins and  tail')
    expect(extractChanges(out.targetRich)).toHaveLength(0)
  })

  it('reject all removes insertions and keeps deletions', () => {
    const { rich } = buildWithChanges()
    const out = resolveAllInRich(rich, 'reject')!
    expect(out.count).toBe(2)
    expect(out.target).toBe('Keep  and del tail')
    expect(extractChanges(out.targetRich)).toHaveLength(0)
  })
})
