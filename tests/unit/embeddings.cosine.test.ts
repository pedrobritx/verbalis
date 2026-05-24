import { describe, expect, it } from 'vitest'
import { cosine } from '@/core/embeddings'

describe('cosine', () => {
  it('returns 1 for identical normalized vectors', () => {
    const v = new Float32Array([1, 0, 0, 0])
    expect(cosine(v, v)).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(cosine(a, b)).toBeCloseTo(0)
  })

  it('returns negative for anti-aligned vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosine(a, b)).toBeCloseTo(-1)
  })

  it('truncates to shorter length', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([1, 0])
    expect(cosine(a, b)).toBeCloseTo(1)
  })
})
