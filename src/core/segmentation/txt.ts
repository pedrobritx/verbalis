import { splitSentences } from './sbdOptions'
import type { ParsedSegment } from './types'

export function segmentTxt(content: string): ParsedSegment[] {
  const blocks = content
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
  const out: ParsedSegment[] = []

  blocks.forEach((block, blockIndex) => {
    const sentences = splitSentences(block)
    sentences.forEach((source, sentenceIndex) => {
      out.push({
        source,
        sourceMeta: { kind: 'paragraph', blockIndex, sentenceIndex },
      })
    })
  })

  return out
}
