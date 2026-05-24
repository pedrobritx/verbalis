import { describe, expect, it, vi } from 'vitest'
import { myMemoryProvider } from '@/core/mt/mymemory'
import type { MyMemorySettings } from '@/core/types'

const settings: MyMemorySettings = {
  enabled: true,
  endpoint: 'https://api.mymemory.translated.net/get',
}

function okResponse(translated: string, extras: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      responseData: { translatedText: translated, match: 0.99 },
      responseStatus: 200,
      ...extras,
    }),
  }
}

describe('myMemoryProvider.translate', () => {
  it('builds a GET request with q and langpair and parses translatedText', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse('Olá mundo'))
    const result = await myMemoryProvider.translate(
      { text: 'Hello world', sourceLang: 'en', targetLang: 'pt' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.text).toBe('Olá mundo')
    expect(result.providerId).toBe('mymemory')

    const [url, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('GET')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('q')).toBe('Hello world')
    expect(parsed.searchParams.get('langpair')).toBe('en|pt')
    expect(parsed.searchParams.get('de')).toBeNull()
  })

  it('includes the contact email when configured (raises daily quota)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse('Olá'))
    await myMemoryProvider.translate(
      { text: 'Hello', sourceLang: 'en', targetLang: 'pt' },
      { ...settings, email: 'user@example.com' },
      fetchImpl as unknown as typeof fetch,
    )
    const [url] = fetchImpl.mock.calls[0]
    expect(new URL(url).searchParams.get('de')).toBe('user@example.com')
  })

  it('rejects requests above the 500-character per-call limit', async () => {
    const fetchImpl = vi.fn()
    await expect(
      myMemoryProvider.translate(
        { text: 'a'.repeat(501), sourceLang: 'en', targetLang: 'pt' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'invalid' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps an in-body quota error to rate_limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: 429,
        responseDetails: 'MYMEMORY WARNING: DAILY QUOTA EXCEEDED',
      }),
    })
    await expect(
      myMemoryProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'pt' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'rate_limit' })
  })

  it('maps an unsupported language-pair response to unsupported_lang', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: 403,
        responseDetails: 'INVALID LANGUAGE PAIR SPECIFIED',
      }),
    })
    await expect(
      myMemoryProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'xx' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'unsupported_lang' })
  })

  it('maps a network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('boom'))
    await expect(
      myMemoryProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'pt' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('throws parse when translatedText is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ responseStatus: 200, responseData: {} }),
    })
    await expect(
      myMemoryProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'pt' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'parse' })
  })
})
