import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Root, RootContent, Paragraph, Blockquote, List, ListItem } from 'mdast'

import { splitSentences } from './sbdOptions'
import type { ParsedSegment } from './types'
import type { SegmentBlockKind } from '@/core/types'

function parseMd(content: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(content) as Root
}

function pushSentences(
  text: string,
  kind: SegmentBlockKind,
  blockIndex: number,
  out: ParsedSegment[],
  extras: Partial<ParsedSegment['sourceMeta']> = {},
): void {
  const sentences = splitSentences(text)
  sentences.forEach((source, sentenceIndex) => {
    out.push({
      source,
      sourceMeta: { kind, blockIndex, sentenceIndex, ...extras },
    })
  })
}

function handleParagraph(node: Paragraph, blockIndex: number, out: ParsedSegment[]) {
  const text = mdastToString(node).trim()
  if (text) pushSentences(text, 'paragraph', blockIndex, out)
}

function handleBlockquote(node: Blockquote, blockIndexRef: { v: number }, out: ParsedSegment[]) {
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      const text = mdastToString(child).trim()
      if (text) {
        pushSentences(text, 'blockquote', blockIndexRef.v, out)
        blockIndexRef.v += 1
      }
    }
  }
}

function handleList(node: List, blockIndexRef: { v: number }, out: ParsedSegment[]) {
  const ordered = Boolean(node.ordered)
  for (const item of node.children as ListItem[]) {
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        const text = mdastToString(child).trim()
        if (text) {
          pushSentences(text, 'list_item', blockIndexRef.v, out, { ordered })
          blockIndexRef.v += 1
        }
      }
    }
  }
}

export function segmentMd(content: string): ParsedSegment[] {
  const tree = parseMd(content)
  const out: ParsedSegment[] = []
  const blockRef = { v: 0 }

  for (const node of tree.children as RootContent[]) {
    switch (node.type) {
      case 'thematicBreak':
        break
      case 'heading': {
        const text = mdastToString(node).trim()
        if (text) {
          out.push({
            source: text,
            sourceMeta: {
              kind: 'heading',
              depth: node.depth,
              blockIndex: blockRef.v,
              sentenceIndex: 0,
            },
          })
          blockRef.v += 1
        }
        break
      }
      case 'code': {
        const text = node.value
        if (text.trim()) {
          out.push({
            source: text,
            sourceMeta: {
              kind: 'code',
              lang: node.lang ?? undefined,
              blockIndex: blockRef.v,
              sentenceIndex: 0,
            },
          })
          blockRef.v += 1
        }
        break
      }
      case 'paragraph': {
        const before = out.length
        handleParagraph(node, blockRef.v, out)
        if (out.length > before) blockRef.v += 1
        break
      }
      case 'blockquote':
        handleBlockquote(node, blockRef, out)
        break
      case 'list':
        handleList(node, blockRef, out)
        break
      default:
        break
    }
  }

  return out
}
