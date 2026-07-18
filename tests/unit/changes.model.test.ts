import { describe, expect, it } from 'vitest'
import { createChangeId } from '@/core/changes/model'

describe('createChangeId', () => {
  it('returns a non-empty string', () => {
    expect(createChangeId()).toBeTruthy()
    expect(typeof createChangeId()).toBe('string')
  })

  it('returns unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createChangeId()))
    expect(ids.size).toBe(1000)
  })
})
