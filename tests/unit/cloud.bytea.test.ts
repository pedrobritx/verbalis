import { describe, expect, it } from 'vitest'
import { encodeBytea, decodeBytea } from '@/storage/cloud/bytea'

describe('bytea encoding', () => {
  it('encodes bytes as a Postgres hex literal', () => {
    expect(encodeBytea(new Uint8Array([0x00, 0x0a, 0x1b, 0xff]))).toBe('\\x000a1bff')
  })

  it('round-trips arbitrary bytes through hex', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) bytes[i] = i
    expect(decodeBytea(encodeBytea(bytes))).toEqual(bytes)
  })

  it('round-trips an empty buffer', () => {
    expect(decodeBytea(encodeBytea(new Uint8Array()))).toEqual(new Uint8Array())
  })

  it('decodes a base64 fallback response', () => {
    // "Yjs" -> base64 "WWpz"; the escape/base64 branch handles configs that
    // don't return the default \x hex form.
    expect(decodeBytea('WWpz')).toEqual(new Uint8Array([0x59, 0x6a, 0x73]))
  })
})
