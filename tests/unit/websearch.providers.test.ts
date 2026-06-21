import { describe, expect, it } from 'vitest'
import {
  buildSearchUrl,
  DEFAULT_WEB_SEARCH_PROVIDERS,
  type WebSearchProvider,
} from '@/core/websearch/providers'

describe('buildSearchUrl', () => {
  it('substitutes and URL-encodes the query', () => {
    const p: WebSearchProvider = {
      id: 'x',
      name: 'X',
      urlTemplate: 'https://e.com/s?q={q}',
      enabled: true,
    }
    expect(buildSearchUrl(p, { q: 'boa-fé objetiva' })).toBe(
      'https://e.com/s?q=boa-f%C3%A9%20objetiva',
    )
  })

  it('substitutes src/tgt language placeholders', () => {
    const p: WebSearchProvider = {
      id: 'wr',
      name: 'WordReference',
      urlTemplate: 'https://www.wordreference.com/{src}{tgt}/{q}',
      enabled: true,
    }
    expect(buildSearchUrl(p, { q: 'dolo', src: 'pt', tgt: 'en' })).toBe(
      'https://www.wordreference.com/pten/dolo',
    )
  })

  it('treats missing src/tgt as empty', () => {
    const p: WebSearchProvider = {
      id: 'd',
      name: 'DeepL',
      urlTemplate: 'https://www.deepl.com/translator#{src}/{tgt}/{q}',
      enabled: true,
    }
    expect(buildSearchUrl(p, { q: 'culpa' })).toBe('https://www.deepl.com/translator#//culpa')
  })

  it('ships all providers disabled by default', () => {
    expect(DEFAULT_WEB_SEARCH_PROVIDERS.every((p) => !p.enabled)).toBe(true)
    expect(DEFAULT_WEB_SEARCH_PROVIDERS.length).toBeGreaterThan(0)
  })
})
