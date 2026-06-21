import { describe, expect, it } from 'vitest'
import {
  classifyInlineTagKind,
  listTagIds,
  nextMissingTagId,
  splitTextWithTags,
} from '@/core/bilingual/inlineTags'

describe('splitTextWithTags', () => {
  it('splits text and tags in order', () => {
    expect(splitTextWithTags('Art. {1} do CDC {2}')).toEqual([
      { type: 'text', value: 'Art. ' },
      { type: 'tag', id: '1' },
      { type: 'text', value: ' do CDC ' },
      { type: 'tag', id: '2' },
    ])
  })

  it('handles adjacent tags and leading tags', () => {
    expect(splitTextWithTags('{1}{2}x')).toEqual([
      { type: 'tag', id: '1' },
      { type: 'tag', id: '2' },
      { type: 'text', value: 'x' },
    ])
  })

  it('returns a single text part when there are no tags', () => {
    expect(splitTextWithTags('plain')).toEqual([{ type: 'text', value: 'plain' }])
  })

  it('rejoining the parts reproduces the input', () => {
    const text = 'a {1} b {2}{3} c'
    const rejoined = splitTextWithTags(text)
      .map((p) => (p.type === 'text' ? p.value : `{${p.id}}`))
      .join('')
    expect(rejoined).toBe(text)
  })
})

describe('listTagIds', () => {
  it('lists ids in order with repeats', () => {
    expect(listTagIds('{2} {1} {2}')).toEqual(['2', '1', '2'])
  })
})

describe('nextMissingTagId', () => {
  it('returns the first source tag absent from the target', () => {
    expect(nextMissingTagId('{1}{2}', '{1}')).toBe('2')
  })

  it('is multiset-aware (a tag used twice needs two in the target)', () => {
    expect(nextMissingTagId('{1} {1}', '{1}')).toBe('1')
  })

  it('returns null when every source tag is present', () => {
    expect(nextMissingTagId('{1}{2}', 'x {2} y {1}')).toBeNull()
  })

  it('returns null when the source has no tags', () => {
    expect(nextMissingTagId('plain', 'qualquer')).toBeNull()
  })
})

describe('classifyInlineTagKind', () => {
  it('detects footnotes', () => {
    expect(classifyInlineTagKind('<ph ctype="x-footnote" id="1"/>')).toBe('footnote')
  })

  it('detects bibliography / citations', () => {
    expect(classifyInlineTagKind('<ph id="1">citation</ph>')).toBe('biblio')
  })

  it('detects quotes from quote glyphs', () => {
    expect(classifyInlineTagKind('<g id="1">“</g>')).toBe('quote')
  })

  it('falls back to generic for plain markup or missing xml', () => {
    expect(classifyInlineTagKind('<ph id="1" x="1"/>')).toBe('generic')
    expect(classifyInlineTagKind(undefined)).toBe('generic')
    expect(classifyInlineTagKind('')).toBe('generic')
  })
})
