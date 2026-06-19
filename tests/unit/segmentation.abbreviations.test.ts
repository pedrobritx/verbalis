import { describe, expect, it } from 'vitest'
import { splitSentences } from '@/core/segmentation/sbdOptions'

describe('splitSentences — non-breaking abbreviations', () => {
  it('does not split after a Portuguese legal abbreviation', () => {
    const text = 'O Art. 5º da Constituição garante direitos. A lei é clara.'
    const out = splitSentences(text)
    expect(out).toHaveLength(2)
    expect(out[0]).toContain('Art. 5º')
  })

  it('keeps "fls." and "Dr." from breaking a sentence', () => {
    expect(splitSentences('Vide fls. 12 do processo principal.')).toHaveLength(1)
    expect(splitSentences('O Dr. Silva apresentou a defesa.')).toHaveLength(1)
  })

  it('still preserves the built-in English abbreviations', () => {
    expect(splitSentences('See Fig. 3 for the result.')).toHaveLength(1)
    expect(splitSentences('Mr. Smith arrived late.')).toHaveLength(1)
  })

  it('still splits genuine sentence boundaries', () => {
    const out = splitSentences('This is one. This is two. This is three.')
    expect(out).toHaveLength(3)
  })
})
