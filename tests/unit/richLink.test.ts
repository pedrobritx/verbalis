import { describe, expect, it } from 'vitest'
import { createEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { richStateToPlain, RICH_NAMESPACE, getRichNodes } from '@/core/editor/richText'
// Importing the node registers it via registerRichNode (side effect) so the
// headless richStateToPlain editor can parse states that contain links.
import { $createLinkNode, $isLinkNode, LinkNode } from '@/features/editor/rich/LinkNode'

function editor() {
  return createEditor({ namespace: RICH_NAMESPACE, nodes: getRichNodes(), onError: () => {} })
}

describe('rich-editor LinkNode', () => {
  it('derives a link back to its visible text in the plain projection', () => {
    const ed = editor()
    ed.update(
      () => {
        const p = $createParagraphNode()
        p.append($createTextNode('see '))
        const link = $createLinkNode('https://example.com')
        link.append($createTextNode('the docs'))
        p.append(link)
        $getRoot().append(p)
      },
      { discrete: true },
    )
    const json = JSON.stringify(ed.getEditorState().toJSON())
    // Plain text — what TM/QA/search/XLIFF consume — is unaffected by the link.
    expect(richStateToPlain(json)).toBe('see the docs')
  })

  it('serializes and restores the url across a JSON round-trip', () => {
    const ed = editor()
    ed.update(
      () => {
        const p = $createParagraphNode()
        const link = $createLinkNode('https://verbalis.app')
        link.append($createTextNode('home'))
        p.append(link)
        $getRoot().append(p)
      },
      { discrete: true },
    )
    const json = JSON.stringify(ed.getEditorState().toJSON())

    const ed2 = editor()
    const state = ed2.parseEditorState(json)
    let url = ''
    let text = ''
    state.read(() => {
      const node = $getRoot().getFirstChild()?.getFirstChild()
      if ($isLinkNode(node)) {
        url = node.getURL()
        text = node.getTextContent()
      }
    })
    expect(url).toBe('https://verbalis.app')
    expect(text).toBe('home')
  })

  it('updating the url is reflected, and unwrapping keeps the text', () => {
    const ed = editor()
    ed.update(
      () => {
        const p = $createParagraphNode()
        const link = $createLinkNode('https://old.example')
        link.append($createTextNode('link text'))
        p.append(link)
        $getRoot().append(p)
      },
      { discrete: true },
    )

    // Edit the URL.
    ed.update(
      () => {
        const node = $getRoot().getFirstChild()?.getFirstChild()
        if ($isLinkNode(node)) node.setURL('https://new.example')
      },
      { discrete: true },
    )
    let current = ''
    ed.getEditorState().read(() => {
      const node = $getRoot().getFirstChild()?.getFirstChild()
      if (node instanceof LinkNode) current = node.getURL()
    })
    expect(current).toBe('https://new.example')

    // Unwrap: move children out and remove the link.
    ed.update(
      () => {
        const node = $getRoot().getFirstChild()?.getFirstChild()
        if ($isLinkNode(node)) {
          for (const child of node.getChildren()) node.insertBefore(child)
          node.remove()
        }
      },
      { discrete: true },
    )
    const json = JSON.stringify(ed.getEditorState().toJSON())
    expect(richStateToPlain(json)).toBe('link text')
    let stillLinked = false
    ed.getEditorState().read(() => {
      stillLinked = $isLinkNode($getRoot().getFirstChild()?.getFirstChild())
    })
    expect(stillLinked).toBe(false)
  })
})
