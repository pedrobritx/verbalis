import { describe, expect, it } from 'vitest'
import { transformCase } from '@/core/text/case'

describe('transformCase', () => {
  it('uppercases and lowercases, accents included', () => {
    expect(transformCase('Hello World', 'upper')).toBe('HELLO WORLD')
    expect(transformCase('Hello World', 'lower')).toBe('hello world')
    expect(transformCase('ártico', 'upper')).toBe('ÁRTICO')
  })

  it('title-cases each word', () => {
    expect(transformCase('the law of cade', 'title')).toBe('The Law Of Cade')
    expect(transformCase('hELLo wORLD', 'title')).toBe('Hello World')
  })

  it('sentence-cases after sentence boundaries', () => {
    expect(transformCase('hello. there. ok?', 'sentence')).toBe('Hello. There. Ok?')
    expect(transformCase('HELLO WORLD', 'sentence')).toBe('Hello world')
  })
})
