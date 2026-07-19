import { describe, expect, it } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from 'lexical'
import { RICH_NAMESPACE, getRichNodes, richStateToPlain } from '@/core/editor/richText'
import '@/features/editor/rich/CommentMarkNode'
import { $createCommentMarkNode } from '@/features/editor/rich/CommentMarkNode'
import { removeCommentMark } from '@/features/editor/rich/comments'
import { groupThreads } from '@/features/editor/comments/commentOps'
import type { SegmentComment } from '@/core/types'

function comment(partial: Partial<SegmentComment> & { id: string }): SegmentComment {
  return { body: 'b', createdAt: '2026-01-01T00:00:00.000Z', ...partial }
}

describe('groupThreads', () => {
  it('groups roots with their replies in chronological order', () => {
    const comments: SegmentComment[] = [
      comment({ id: 'r1', anchorId: 'a1', quote: 'hello' }),
      comment({ id: 'x2', parentId: 'r1', createdAt: '2026-01-01T00:02:00.000Z' }),
      comment({ id: 'x1', parentId: 'r1', createdAt: '2026-01-01T00:01:00.000Z' }),
      comment({ id: 'r2' }),
    ]
    const threads = groupThreads(comments)
    expect(threads).toHaveLength(2)
    expect(threads[0].root.id).toBe('r1')
    expect(threads[0].replies.map((r) => r.id)).toEqual(['x1', 'x2']) // sorted by time
    expect(threads[1].root.id).toBe('r2')
    expect(threads[1].replies).toEqual([])
  })

  it('returns [] for no comments', () => {
    expect(groupThreads(undefined)).toEqual([])
  })
})

function buildWithComment(): string {
  const editor: LexicalEditor = createEditor({
    namespace: RICH_NAMESPACE,
    nodes: getRichNodes(),
    onError: (e) => {
      throw e
    },
  })
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const p = $createParagraphNode()
      p.append($createTextNode('hello '))
      const mark = $createCommentMarkNode('anchor-1')
      mark.append($createTextNode('world'))
      p.append(mark)
      root.append(p)
    },
    { discrete: true },
  )
  return JSON.stringify(editor.getEditorState().toJSON())
}

describe('comment anchors', () => {
  it('a comment mark leaves the derived plain text unchanged', () => {
    expect(richStateToPlain(buildWithComment())).toBe('hello world')
  })

  it('removeCommentMark unwraps the anchor and preserves plain text', () => {
    const rich = buildWithComment()
    const out = removeCommentMark(rich, 'anchor-1')!
    expect(out.target).toBe('hello world')
    expect(out.targetRich).not.toContain('comment-mark')
    // Original still had the mark.
    expect(rich).toContain('comment-mark')
  })

  it('removeCommentMark returns null for an unknown anchor or missing input', () => {
    expect(removeCommentMark(buildWithComment(), 'nope')).toBeNull()
    expect(removeCommentMark(undefined, 'anchor-1')).toBeNull()
  })
})
