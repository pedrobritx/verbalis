import { describe, expect, it, vi } from 'vitest'
import { libreTranslateProvider } from '@/core/mt/libretranslate'
import type { LibreTranslateSettings } from '@/core/types'

const settings: LibreTranslateSettings = {
  enabled: true,
  endpoint: 'https://libretranslate.com/translate',
}

describe('libreTranslateProvider.translate', () => {
  it('posts q/source/target and parses translatedText', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ translatedText: 'Bonjour' }),
    })
    const result = await libreTranslateProvider.translate(
      { text: 'Hello', sourceLang: 'en', targetLang: 'fr' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.text).toBe('Bonjour')
    expect(result.providerId).toBe('libretranslate')

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://libretranslate.com/translate')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ q: 'Hello', source: 'en', target: 'fr', format: 'text' })
    expect(body.api_key).toBeUndefined()
  })

  it('includes api_key when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ translatedText: 'x' }),
    })
    await libreTranslateProvider.translate(
      { text: 'hi', sourceLang: 'en', targetLang: 'es' },
      { ...settings, apiKey: 'libre-123' },
      fetchImpl as unknown as typeof fetch,
    )
    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body).api_key).toBe('libre-123')
  })

  it('maps 400 to unsupported_lang', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'lang nope' }),
    })
    await expect(
      libreTranslateProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'xx' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'unsupported_lang' })
  })

  it('maps 403 to auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    })
    await expect(
      libreTranslateProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'auth' })
  })

  it('maps network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('boom'))
    await expect(
      libreTranslateProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('throws parse when translatedText missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    await expect(
      libreTranslateProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'parse' })
  })
})
