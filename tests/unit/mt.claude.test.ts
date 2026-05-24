import { describe, expect, it, vi } from 'vitest'
import { claudeProvider } from '@/core/mt/claude'
import type { ClaudeSettings } from '@/core/types'

const settings: ClaudeSettings = {
  enabled: true,
  apiKey: 'sk-ant-test',
  model: 'claude-haiku-4-5-20251001',
}

function okResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text }] }),
  }
}

describe('claudeProvider.translate', () => {
  it('sends required headers and parses content', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(okResponse('Hola'))
    const result = await claudeProvider.translate(
      { text: 'Hello', sourceLang: 'en', targetLang: 'es' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.text).toBe('Hola')
    expect(result.providerId).toBe('claude')

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')

    const body = JSON.parse(init.body)
    expect(body.model).toBe('claude-haiku-4-5-20251001')
    expect(body.system).toMatch(/from en to es/)
    expect(body.messages[0].content).toBe('Hello')
  })

  it('joins multiple text blocks', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          { type: 'text', text: 'Hola ' },
          { type: 'tool_use', text: 'ignored' },
          { type: 'text', text: 'mundo' },
        ],
      }),
    })
    const result = await claudeProvider.translate(
      { text: 'Hi', sourceLang: 'en', targetLang: 'es' },
      settings,
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.text).toBe('Hola mundo')
  })

  it('maps 401 to auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
    })
    await expect(
      claudeProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'auth' })
  })

  it('maps 429 to rate_limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    })
    await expect(
      claudeProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'rate_limit' })
  })

  it('throws auth when key is empty', async () => {
    await expect(
      claudeProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        { ...settings, apiKey: '' },
      ),
    ).rejects.toMatchObject({ code: 'auth' })
  })

  it('throws aborted on AbortError', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(
      claudeProvider.translate(
        { text: 'hi', sourceLang: 'en', targetLang: 'es' },
        settings,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
  })
})
