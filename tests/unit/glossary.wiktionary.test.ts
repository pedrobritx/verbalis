import { describe, expect, it, vi } from 'vitest'
import {
  fetchWiktionaryEntry,
  parseTranslationsFromWikitext,
  WiktionaryError,
} from '@/core/glossary/wiktionary'

const DEFINITION_RESPONSE = {
  en: [
    {
      partOfSpeech: 'Noun',
      language: 'English',
      definitions: [
        { definition: 'A common <i>greeting</i>.', examples: ['<b>Hello</b>, world!'] },
        { definition: 'A short cry to attract attention.' },
      ],
    },
    {
      partOfSpeech: 'Verb',
      language: 'English',
      definitions: [{ definition: 'To say hello.' }],
    },
  ],
}

const PARSE_RESPONSE = {
  parse: {
    wikitext: {
      '*': `==Translations==
{{trans-top|greeting}}
* Spanish: {{t+|es|hola}}
* French: {{t|fr|bonjour}}
* German: {{t+|de|hallo}}
{{trans-bottom}}`,
    },
  },
}

function mockFetch(): ReturnType<typeof vi.fn> {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => DEFINITION_RESPONSE,
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => PARSE_RESPONSE,
    })
}

describe('parseTranslationsFromWikitext', () => {
  it('extracts {{t|lang|value}} and {{t+|lang|value}} templates', () => {
    const out = parseTranslationsFromWikitext(PARSE_RESPONSE.parse.wikitext['*'])
    expect(out).toEqual({ es: 'hola', fr: 'bonjour', de: 'hallo' })
  })

  it('keeps the first translation per language', () => {
    const out = parseTranslationsFromWikitext('{{t|es|hola}} {{t|es|saludo}}')
    expect(out).toEqual({ es: 'hola' })
  })

  it('returns an empty object when no templates present', () => {
    expect(parseTranslationsFromWikitext('plain text')).toEqual({})
  })
})

describe('fetchWiktionaryEntry', () => {
  it('parses definitions and translations on success', async () => {
    const fetchImpl = mockFetch()
    const result = await fetchWiktionaryEntry('hello', 'en', fetchImpl as unknown as typeof fetch)
    expect(result.term).toBe('hello')
    expect(result.definitions).toHaveLength(3)
    expect(result.definitions[0].partOfSpeech).toBe('Noun')
    expect(result.definitions[0].definition).toBe('A common greeting.')
    expect(result.definitions[0].examples?.[0]).toBe('Hello, world!')
    expect(result.translations).toEqual({ es: 'hola', fr: 'bonjour', de: 'hallo' })
  })

  it('throws not_found on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(
      fetchWiktionaryEntry('zzzz', 'en', fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('throws network on fetch rejection', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline'))
    await expect(
      fetchWiktionaryEntry('hello', 'en', fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('throws invalid when the term is empty', async () => {
    await expect(fetchWiktionaryEntry('   ')).rejects.toBeInstanceOf(WiktionaryError)
  })

  it('degrades gracefully when translations call fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => DEFINITION_RESPONSE,
      })
      .mockRejectedValueOnce(new Error('cors blocked'))
    const result = await fetchWiktionaryEntry('hello', 'en', fetchImpl as unknown as typeof fetch)
    expect(result.definitions.length).toBeGreaterThan(0)
    expect(result.translations).toEqual({})
  })
})
