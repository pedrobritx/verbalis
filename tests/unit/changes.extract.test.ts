import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes } from '@/core/editor/richText'
// Importing the node registers it (side effect) so the headless editor can build
// and serialize states containing change marks.
import { $createChangeMarkNode } from '@/features/editor/rich/ChangeMarkNode'
import { extractChanges, hasPendingChanges } from '@/core/changes/extract'

function buildTargetRich(): string {
  const editor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: () => {},
  })
  editor.update(
    () => {
      const root = $getRoot()
      const p = $createParagraphNode()
      p.append($createTextNode('Hello '))
      const ins = $createChangeMarkNode({
        changeId: 'c-ins',
        changeType: 'insert',
        authorId: 'a1',
        authorName: 'Ada',
        createdAt: 1000,
      })
      ins.append($createTextNode('brave '))
      p.append(ins)
      p.append($createTextNode('new '))
      const del = $createChangeMarkNode({
        changeId: 'c-del',
        changeType: 'delete',
        authorId: 'a2',
        authorName: 'Bo',
        createdAt: 2000,
      })
      del.append($createTextNode('old '))
      p.append(del)
      p.append($createTextNode('world'))
      root.append(p)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

describe('extractChanges', () => {
  it('lists every change with attribution and wrapped text in order', () => {
    const changes = extractChanges(buildTargetRich())
    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({
      id: 'c-ins',
      type: 'insert',
      authorId: 'a1',
      authorName: 'Ada',
      createdAt: 1000,
      text: 'brave ',
    })
    expect(changes[1]).toMatchObject({
      id: 'c-del',
      type: 'delete',
      authorId: 'a2',
      authorName: 'Bo',
      createdAt: 2000,
      text: 'old ',
    })
  })

  it('returns [] for empty or unparseable input', () => {
    expect(extractChanges(undefined)).toEqual([])
    expect(extractChanges('')).toEqual([])
    expect(extractChanges('{ not json')).toEqual([])
  })

  it('hasPendingChanges reflects presence of any change', () => {
    expect(hasPendingChanges(buildTargetRich())).toBe(true)
    expect(hasPendingChanges(undefined)).toBe(false)
  })
})
